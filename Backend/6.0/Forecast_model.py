import os
import pandas as pd
import numpy as np
from prophet import Prophet
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
import matplotlib.pyplot as plt
import joblib

# ----------------- Setup ----------------- #
OUTPUT_DIR = "outputs3"
os.makedirs(OUTPUT_DIR, exist_ok=True)

# ----------------- Load Data ----------------- #
df = pd.read_csv("2_Melting_Day_level_data.csv")
df['ds'] = pd.to_datetime(df['ds'])

# ----------------- Feature Engineering ----------------- #
df['is_weekend'] = (df['ds'].dt.weekday >= 5).astype(int)
df['is_month_end'] = df['ds'].dt.is_month_end.astype(int)

# ----------------- Train/Test Split ----------------- #
train_df = df[df['ds'] <= '2025-04-30']
test_df = df[df['ds'] > '2025-04-30']

# ----------------- Train Prophet ----------------- #
model = Prophet()
model.add_regressor('production')
model.add_regressor('anomaly_intensity')
model.add_regressor('batch_count')
model.add_regressor('is_weekend')
model.add_regressor('is_month_end')
model.fit(train_df)

# Save the model
joblib.dump(model, os.path.join(OUTPUT_DIR, "model.pkl"))

# ----------------- Predict on Test ----------------- #
test_future = test_df[['ds', 'production', 'anomaly_intensity', 'batch_count', 'is_weekend', 'is_month_end']]
forecast_test = model.predict(test_future)
test_df = test_df.merge(forecast_test[['ds', 'yhat']], on='ds', how='left')

# ----------------- Forecast Future ----------------- #
future_period = 15
last_date = df['ds'].max()
future_dates = pd.date_range(start=last_date + pd.Timedelta(days=1), periods=future_period)

# Estimate production, anomaly_intensity, etc. for future
future_df = pd.DataFrame({'ds': future_dates})
future_df['is_weekend'] = (future_df['ds'].dt.weekday >= 5).astype(int)
future_df['is_month_end'] = future_df['ds'].dt.is_month_end.astype(int)

n_weekdays = (future_df['is_weekend'] == 0).sum()
n_weekends = (future_df['is_weekend'] == 1).sum()
weekday_prod = 24000
weekend_prod = 12000
total_production = (n_weekdays * weekday_prod) + (n_weekends * weekend_prod)
total_needed = (n_weekdays * weekday_prod) + (n_weekends * weekend_prod)
scaling_factor = total_production / total_needed
future_df['production'] = future_df['is_weekend'].map({0: weekday_prod, 1: weekend_prod}) * scaling_factor
future_df['batch_count'] = future_df['production'] / 1000

# Add anomaly intensity with variation
avg_anomaly_intensity = df['anomaly_intensity'].mean()
np.random.seed(42)
future_df['anomaly_intensity'] = np.clip(
    np.random.normal(loc=avg_anomaly_intensity, scale=0.3 * avg_anomaly_intensity, size=len(future_df)),
    a_min=0,
    a_max=None
)

# Predict future
forecast_future = model.predict(future_df)
forecast_future.to_csv(os.path.join(OUTPUT_DIR, "future_forecast.csv"), index=False)

# ----------------- Combine for Visualization ----------------- #
train_df['set'] = 'train'
test_df['set'] = 'test'
forecast_future['set'] = 'forecast'

combined = pd.concat([
    train_df[['ds', 'y', 'set']],
    test_df[['ds', 'y', 'yhat', 'set']],
    forecast_future[['ds', 'yhat', 'set']]
], sort=False)
combined.to_csv(os.path.join(OUTPUT_DIR, "combined_results.csv"), index=False)

# ----------------- Evaluation ----------------- #
y_true = test_df['y']
y_pred = test_df['yhat']
mae = mean_absolute_error(y_true, y_pred)
rmse = np.sqrt(mean_squared_error(y_true, y_pred))
r2 = r2_score(y_true, y_pred)

print("\n\U0001F4CA Model Evaluation (Test Set):")
print(f"MAE  = {mae:.2f}")
print(f"RMSE = {rmse:.2f}")
print(f"R²   = {r2:.3f}")

# ----------------- Visualization ----------------- #
plt.figure(figsize=(14, 6))
plt.plot(train_df['ds'], train_df['y'], label='Train Actual', color='black', alpha=0.5)
plt.plot(test_df['ds'], test_df['y'], label='Test Actual', color='blue')
plt.plot(test_df['ds'], test_df['yhat'], label='Test Predicted', linestyle='--', color='orange')
plt.plot(forecast_future['ds'], forecast_future['yhat'], label='Future Forecast', linestyle='--', color='green')
plt.axvline(pd.to_datetime('2025-04-30'), color='gray', linestyle='--', alpha=0.6, label='Train/Test Split')
plt.title("Energy Consumption Forecast (Train, Test & 15-day Forecast)")
plt.xlabel("Date")
plt.ylabel("Energy Consumption (kWh)")
plt.legend()
plt.grid(True)
plt.tight_layout()
plt.savefig(os.path.join(OUTPUT_DIR, "forecast_plot.png"))
plt.close()

# ----------------- Optional: Save example frontend prediction ----------------- #
# Example live prediction from frontend-style input
live_start_date = pd.to_datetime("2025-05-27")
live_end_date = pd.to_datetime("2025-06-05")
live_total_production = 216000
live_avg_anomaly_intensity = 5

live_range = pd.date_range(start=live_start_date, end=live_end_date, freq='D')
live_df = pd.DataFrame({'ds': live_range})
live_df['is_weekend'] = (live_df['ds'].dt.weekday >= 5).astype(int)
live_df['is_month_end'] = live_df['ds'].dt.is_month_end.astype(int)

n_weekdays = (live_df['is_weekend'] == 0).sum()
n_weekends = (live_df['is_weekend'] == 1).sum()
live_total_needed = (n_weekdays * weekday_prod) + (n_weekends * weekend_prod)
live_scaling = live_total_production / live_total_needed
live_df['production'] = live_df['is_weekend'].map({0: weekday_prod, 1: weekend_prod}) * live_scaling
live_df['batch_count'] = live_df['production'] / 1000

np.random.seed(42)
live_df['anomaly_intensity'] = np.clip(
    np.random.normal(loc=live_avg_anomaly_intensity, scale=0.3 * live_avg_anomaly_intensity, size=len(live_df)),
    a_min=0,
    a_max=None
)

live_forecast = model.predict(live_df)
live_output = live_forecast[['ds', 'yhat', 'yhat_lower', 'yhat_upper']]
live_output.to_csv(os.path.join(OUTPUT_DIR, "live_forecast.csv"), index=False)
