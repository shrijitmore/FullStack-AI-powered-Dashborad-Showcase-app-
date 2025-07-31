from flask import Flask, render_template, jsonify, request
from flask_cors import CORS
import pandas as pd
import joblib
from collections import defaultdict
import os
import logging
from datetime import datetime
import numpy as np

# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

try:
    # Load model and encoder once
    model = joblib.load('xgb_anomaly_model.pkl')
    le = joblib.load('label_encoder.pkl')
    forecast_model = joblib.load('forecast_model.pkl')  # Load the Prophet forecast model
    logger.info("Successfully loaded models")

    # Load full CSV stream
    data_file = '1_minuteWiseData_Melting_energy_3.0_DB2.csv'
    if not os.path.exists(data_file):
        raise FileNotFoundError(f"Data file not found: {data_file}")
    
    try:
        data_stream = pd.read_csv(data_file, encoding='utf-8')
        data_stream['timestamp'] = pd.to_datetime(data_stream['timestamp'], format='%d-%m-%Y %H:%M')
        logger.info(f"Successfully loaded data file with {len(data_stream)} rows")
    except UnicodeDecodeError:
        data_stream = pd.read_csv(data_file, encoding='latin1')
        data_stream['timestamp'] = pd.to_datetime(data_stream['timestamp'], format='%d-%m-%Y %H:%M')
        logger.info(f"Successfully loaded data file with {len(data_stream)} rows using latin1 encoding")
    current_index = [0]  # using list for mutability inside route

    # Load day level data
    day_data_file = '2_Melting_Day_level_data.csv'
    if not os.path.exists(day_data_file):
        raise FileNotFoundError(f"Day level data file not found: {day_data_file}")
    
    try:
        day_data = pd.read_csv(day_data_file, encoding='utf-8')
        day_data['ds'] = pd.to_datetime(day_data['ds'], format='%d-%m-%Y')
        logger.info(f"Successfully loaded day level data with {len(day_data)} rows")
    except UnicodeDecodeError:
        day_data = pd.read_csv(day_data_file, encoding='latin1')
        day_data['ds'] = pd.to_datetime(day_data['ds'], format='%d-%m-%Y')
        logger.info(f"Successfully loaded day level data with {len(day_data)} rows using latin1 encoding")

    # Load batch data
    batch_data_file = '2_Melting_batch_data.csv'
    if not os.path.exists(batch_data_file):
        raise FileNotFoundError(f"Batch data file not found: {batch_data_file}")
    
    try:
        batch_data = pd.read_csv(batch_data_file, encoding='utf-8')
        batch_data['timestamp'] = pd.to_datetime(batch_data['timestamp'], format='%d-%m-%Y %H:%M')
        logger.info(f"Successfully loaded batch data with {len(batch_data)} rows")
    except UnicodeDecodeError:
        batch_data = pd.read_csv(batch_data_file, encoding='latin1')
        batch_data['timestamp'] = pd.to_datetime(batch_data['timestamp'], format='%d-%m-%Y %H:%M')
        logger.info(f"Successfully loaded batch data with {len(batch_data)} rows using latin1 encoding")

    # Load test results
    test_results_file = 'test results.csv'
    if not os.path.exists(test_results_file):
        raise FileNotFoundError(f"Test results file not found: {test_results_file}")
    
    try:
        test_results = pd.read_csv(test_results_file, encoding='utf-8')
        # Check if 'ds' column exists (Prophet format) or 'timestamp' column exists
        if 'ds' in test_results.columns:
            test_results['timestamp'] = pd.to_datetime(test_results['ds'])
        elif 'timestamp' in test_results.columns:
            test_results['timestamp'] = pd.to_datetime(test_results['timestamp'])
        else:
            raise ValueError("Test results file must contain either 'ds' or 'timestamp' column")
        logger.info(f"Successfully loaded test results with {len(test_results)} rows")
    except UnicodeDecodeError:
        test_results = pd.read_csv(test_results_file, encoding='latin1')
        if 'ds' in test_results.columns:
            test_results['timestamp'] = pd.to_datetime(test_results['ds'])
        elif 'timestamp' in test_results.columns:
            test_results['timestamp'] = pd.to_datetime(test_results['timestamp'])
        else:
            raise ValueError("Test results file must contain either 'ds' or 'timestamp' column")
        logger.info(f"Successfully loaded test results with {len(test_results)} rows using latin1 encoding")

except Exception as e:
    logger.error(f"Error during initialization: {str(e)}")
    raise

# Prescription map
prescription_map = {
    'power_spike': {
        'possible_reason': 'Overload on the power system',
        'cause': 'Sudden high load or faulty power control',
        'solution': 'Check load balancing & inspect control systems'
    },
    'power_drop': {
        'possible_reason': 'Underpowering the furnace',
        'cause': 'Voltage fluctuation & Transformer issue',
        'solution': 'Stabilize voltage & check transformer health'
    },
    'high_pf': {
        'possible_reason': 'Overcompensated power factor correction',
        'cause': 'Excess capacitor bank usage',
        'solution': 'Adjust capacitor banks & check reactive power'
    },
    'low_pf': {
        'possible_reason': 'Inefficient power usage',
        'cause': 'Load imbalance & capacitance imbalance',
        'solution': 'Improve load distribution or inductance imbalance'
    },
    'normal': {
        'possible_reason': '—',
        'cause': '—',
        'solution': 'No action needed, System operating Normally'
    }
}

# Global counter
anomaly_counter = defaultdict(int)

@app.route('/')
def index():
    try:
        logger.info("Rendering dashboard template")
        return render_template('dashboard.html')
    except Exception as e:
        logger.error(f"Error rendering dashboard: {str(e)}")
        return f"Error loading dashboard: {str(e)}", 500

@app.route('/data')
def stream_data():
    try:
        # Filter data for May 11th, 2025 starting from 8 AM
        target_date = pd.to_datetime('11-05-2025 08:00:00', format='%d-%m-%Y %H:%M:%S')
        data_stream_day = data_stream[
            (data_stream['timestamp'].dt.date == target_date.date()) & 
            (data_stream['timestamp'].dt.time >= target_date.time())
        ]
        
        # End of stream
        if current_index[0] >= len(data_stream_day):
            return jsonify({
                'prediction': 'Done',
                'prescription': {},
                'history': [],
                'anomaly_counter': dict(anomaly_counter)
            })

        # Get next row
        row = data_stream_day.iloc[current_index[0]]
        current_index[0] += 1

        # Prepare input for prediction
        features = ['melting_batch_time', 'idle_batch_time', 'power_kw', 'power_factor',
                    'furnace_temperature', 'batch_status', 'energy_reading_pm', 'energy_reading_cumm']
        input_df = pd.DataFrame([row[features].to_dict()])
        pred = model.predict(input_df)
        label = le.inverse_transform(pred)[0]

        # Update anomaly counter
        anomaly_counter[label] += 1

        # Fetch prescription
        prescription = prescription_map.get(label, {
            'possible_reason': 'N/A',
            'cause': 'N/A',
            'solution': 'N/A'
        })

        # Keep last 15 rows for chart
        history_data = data_stream_day.iloc[max(0, current_index[0] - 15):current_index[0]].copy()
        history_data['label'] = ['Normal'] * len(history_data)  # default
        history_data.iloc[-1, history_data.columns.get_loc('label')] = label  # last one is current prediction

        # Calculate total consumption for the day so far
        total_consumption = data_stream_day.iloc[:current_index[0]]['energy_reading_pm'].sum()

        # Get current timestamp
        current_timestamp = history_data.iloc[-1]['timestamp']

        # Ensure all required columns are present and in the correct format
        chart_data = []
        for _, row in history_data.iterrows():
            chart_data.append({
                'timestamp': str(row['timestamp']),
                'power_kw': float(row['power_kw']),
                'power_factor': float(row['power_factor']),
                'label': str(row['label'])
            })

        return jsonify({
            'prediction': label,
            'prescription': {
                'possible_reason': prescription['possible_reason'],
                'cause': prescription['cause'],
                'solution': prescription['solution']
            },
            'history': chart_data,
            'anomaly_counter': dict(anomaly_counter),
            'total_consumption': total_consumption,
            'current_timestamp': str(current_timestamp)
        })
    except Exception as e:
        logger.error(f"Error in stream_data: {str(e)}")
        return jsonify({
            'error': str(e),
            'prediction': 'Error',
            'prescription': {
                'possible_reason': 'Error occurred',
                'cause': 'System error',
                'solution': 'Please try again'
            },
            'history': [],
            'anomaly_counter': dict(anomaly_counter)
        }), 500

@app.route('/historical_data')
def get_historical_data():
    try:
        # Convert timestamp to datetime with the correct format
        data_stream['timestamp'] = pd.to_datetime(data_stream['timestamp'], format='%d-%m-%Y %H:%M')
        logger.info(f"Data range: {data_stream['timestamp'].min()} to {data_stream['timestamp'].max()}")
        
        # Monthly consumption
        monthly_data = data_stream.groupby(data_stream['timestamp'].dt.strftime('%Y-%m'))['energy_reading_pm'].sum().reset_index()
        monthly_data.columns = ['month', 'consumption']
        logger.info(f"Monthly data: {monthly_data.to_dict(orient='records')}")
        
        # Weekly consumption with proper date handling
        data_stream['week'] = data_stream['timestamp'].dt.strftime('%Y-%U')
        weekly_data = data_stream.groupby('week')['energy_reading_pm'].sum().reset_index()
        weekly_data.columns = ['week', 'consumption']
        
        # Format week labels to be more readable with correct month
        def get_week_label(week_str):
            year, week_num = week_str.split('-')
            # Get the date of the first day of the week
            first_day = datetime.strptime(f"{year}-W{week_num}-1", "%Y-W%W-%w")
            # Get the month of the first day
            month = first_day.strftime('%b')
            return f"Week {week_num}, {month}"
        
        weekly_data['week_label'] = weekly_data['week'].apply(get_week_label)
        logger.info(f"Weekly data: {weekly_data.to_dict(orient='records')}")

        # Prepare daily data
        daily_data = day_data[['ds', 'y', 'anomaly_intensity']].copy()
        daily_data['date'] = daily_data['ds'].dt.strftime('%Y-%m-%d')
        daily_data = daily_data.sort_values('ds')
        
        response_data = {
            'monthly': monthly_data.to_dict(orient='records'),
            'weekly': weekly_data.to_dict(orient='records'),
            'daily': daily_data.to_dict(orient='records')
        }
        logger.info(f"Sending response: {response_data}")
        return jsonify(response_data)
    except Exception as e:
        logger.error(f"Error in historical data: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/batch_data')
def get_batch_data():
    try:
        # Filter data for May 10th, 2025
        target_date = pd.to_datetime('10-05-2025', format='%d-%m-%Y')
        logger.info(f"Filtering data for date: {target_date}")
        
        # Log the date range in the data
        logger.info(f"Data date range: {batch_data['timestamp'].min()} to {batch_data['timestamp'].max()}")
        
        batch_data_day = batch_data[batch_data['timestamp'].dt.date == target_date.date()]
        logger.info(f"Found {len(batch_data_day)} records for the target date")
        
        if len(batch_data_day) == 0:
            logger.warning("No data found for the target date")
            return jsonify({'error': 'No data found for the specified date'}), 404
        
        # Calculate total anomalies
        batch_data_day['total_anomalies'] = (
            batch_data_day['power_spike'] + 
            batch_data_day['power_drop'] + 
            batch_data_day['high_pf'] + 
            batch_data_day['low_pf']
        )
        
        # Sort by batch_id
        batch_data_day = batch_data_day.sort_values('batch_id')
        
        # Select and rename columns for the response
        response_data = {
            'batches': batch_data_day[['batch_id', 'consumption', 'total_anomalies']].to_dict(orient='records')
        }
        
        logger.info(f"Sending batch data response with {len(batch_data_day)} batches")
        return jsonify(response_data)
    except Exception as e:
        logger.error(f"Error in batch data: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/test_results')
def get_test_results():
    try:
        # Prepare test results data
        test_data = test_results.copy()
        
        # Handle both Prophet and non-Prophet format
        if 'y' in test_data.columns and 'yhat' in test_data.columns:
            # Already in correct format
            pass
        elif 'actual' in test_data.columns and 'predicted' in test_data.columns:
            # Rename columns to match expected format
            test_data = test_data.rename(columns={
                'actual': 'y',
                'predicted': 'yhat'
            })
        else:
            raise ValueError("Test results must contain either (y, yhat) or (actual, predicted) columns")
        
        # Select and format required columns
        test_data = test_data[['timestamp', 'y', 'yhat']]
        test_data['timestamp'] = test_data['timestamp'].dt.strftime('%Y-%m-%d')
        
        response_data = {
            'results': test_data.to_dict(orient='records')
        }
        
        logger.info(f"Sending test results with {len(test_data)} records")
        return jsonify(response_data)
    except Exception as e:
        logger.error(f"Error in test results: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/forecast', methods=['POST'])
def generate_forecast():
    try:
        data = request.get_json()
        start_date = pd.to_datetime(data.get('start_date', '12-05-2025'), format='%Y-%m-%d')
        end_date = pd.to_datetime(data.get('end_date', '26-05-2025'), format='%Y-%m-%d')
        production = float(data.get('production', 288000))
        anomaly_intensity = float(data.get('anomaly_intensity', 5))

        # Create future dataframe for Prophet
        future_df = pd.DataFrame({'ds': pd.date_range(start=start_date, end=end_date)})
        
        # Add weekend and month-end flags
        future_df['is_weekend'] = (future_df['ds'].dt.weekday >= 5).astype(int)
        future_df['is_month_end'] = future_df['ds'].dt.is_month_end.astype(int)
        
        # Production logic with weekday/weekend distribution
        n_weekdays = (future_df['is_weekend'] == 0).sum()
        n_weekends = (future_df['is_weekend'] == 1).sum()
        weekday_prod = 24000  # Base production for weekdays
        weekend_prod = 12000  # Base production for weekends
        total_needed = (n_weekdays * weekday_prod) + (n_weekends * weekend_prod)
        scaling_factor = production / total_needed
        
        # Apply production scaling
        future_df['production'] = future_df['is_weekend'].map({0: weekday_prod, 1: weekend_prod}) * scaling_factor
        
        # Add batch count (1 batch per 1000 kg)
        future_df['batch_count'] = future_df['production'] / 1000
        
        # Add anomaly intensity with variation
        np.random.seed(42)  # For reproducibility
        future_df['anomaly_intensity'] = np.clip(
            np.random.normal(
                loc=anomaly_intensity,
                scale=0.3 * anomaly_intensity,
                size=len(future_df)
            ),
            a_min=0,
            a_max=None
        )

        # Generate forecast
        forecast = forecast_model.predict(future_df)
        
        # Prepare response data with confidence intervals and anomaly intensity
        forecast_data = []
        for _, row in forecast.iterrows():
            date = row['ds']
            forecast_data.append({
                'date': date.strftime('%Y-%m-%d'),
                'yhat': row['yhat'],
                'yhat_lower': row['yhat_lower'],
                'yhat_upper': row['yhat_upper'],
                'anomaly_intensity': float(future_df.loc[future_df['ds'] == date, 'anomaly_intensity'].iloc[0]),
                'is_month_end': bool(future_df.loc[future_df['ds'] == date, 'is_month_end'].iloc[0])
            })
        
        response_data = {
            'forecast': forecast_data
        }
        
        logger.info(f"Generated forecast for {len(forecast_data)} days")
        return jsonify(response_data)
    except Exception as e:
        logger.error(f"Error in forecast generation: {str(e)}")
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0') 