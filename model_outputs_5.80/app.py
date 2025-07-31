import pandas as pd
import joblib
import json
import argparse
import sys
import os

def prepare_future_dataframe(start_date, end_date, production):
    try:
        future_dates = pd.date_range(start=start_date, end=end_date)
        df = pd.DataFrame({'ds': future_dates})

        df['day_of_week'] = df['ds'].dt.weekday
        df['is_weekend'] = df['day_of_week'].isin([5, 6]).astype(int)
        df['is_month_end_period'] = (df['ds'].dt.day > 25).astype(int)
        
        # batch_count: 24 for weekdays, 12 for weekends
        df['batch_count'] = df['is_weekend'].apply(lambda x: 12 if x == 1 else 24)

        # For y_rolling_mean_7d and y_lag_7, you can use production or a fixed heuristic
        df['y_rolling_mean_7d'] = production
        df['y_lag_7'] = production

        df['anomaly_intensity'] = 140  # Assuming no anomaly in forecast

        # Add production as a regressor as well
        df['production'] = production

        return df
    except Exception as e:
        print(json.dumps({'error': f'Error preparing future dataframe: {str(e)}'}), file=sys.stderr)
        sys.exit(1)

def main():
    parser = argparse.ArgumentParser(description='Generate energy consumption forecast')
    parser.add_argument('--start_date', required=True, help='Start date for forecast (YYYY-MM-DD)')
    parser.add_argument('--end_date', required=True, help='End date for forecast (YYYY-MM-DD)')
    parser.add_argument('--production', required=True, type=float, help='Production value')
    
    args = parser.parse_args()

    try:
        # Validate dates
        pd.to_datetime(args.start_date)
        pd.to_datetime(args.end_date)
        
        # Validate production value
        if args.production <= 0:
            raise ValueError("Production value must be positive")

        # Get the directory of the current script
        script_dir = os.path.dirname(os.path.abspath(__file__))
        model_path = os.path.join(script_dir, "prophet_energy_forecasting_model.pkl")
        
        # Check if model file exists
        if not os.path.exists(model_path):
            raise FileNotFoundError(f"Model file not found at {model_path}")

        # Load the model
        model = joblib.load(model_path)
        
        # Prepare data
        future_df = prepare_future_dataframe(args.start_date, args.end_date, args.production)
        
        # Generate forecast
        forecast = model.predict(future_df)
        
        # Format the forecast data
        forecast_data = []
        for i in range(len(forecast)):
            forecast_data.append({
                'date': forecast['ds'].iloc[i].strftime('%Y-%m-%d'),
                'predictedValue': float(forecast['yhat'].iloc[i]),
                'lowerBound': float(forecast['yhat_lower'].iloc[i]),
                'upperBound': float(forecast['yhat_upper'].iloc[i])
            })
        
        # Print the forecast data as JSON
        print(json.dumps(forecast_data))
        
    except ValueError as ve:
        print(json.dumps({'error': f'Validation error: {str(ve)}'}), file=sys.stderr)
        sys.exit(1)
    except FileNotFoundError as fe:
        print(json.dumps({'error': f'File not found: {str(fe)}'}), file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(json.dumps({'error': f'Unexpected error: {str(e)}'}), file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
