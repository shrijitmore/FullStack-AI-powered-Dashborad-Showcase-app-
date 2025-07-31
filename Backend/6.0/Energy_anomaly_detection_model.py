import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
from xgboost import XGBClassifier
from sklearn.metrics import classification_report, confusion_matrix
import warnings
warnings.filterwarnings('ignore')

# --- Load clean dataset ---
df = pd.read_csv("Melting_energy_3.0_DB2.csv")  # Replace with actual path

# --- Updated Label generation logic ---
def label_anomaly(row):
    if row['batch_status'] == 1 and row['melting_batch_time'] != 0:
        if row['power_kw'] < 350:
            return 'power_drop'
        elif row['power_kw'] > 400:
            return 'power_spike'
        elif row['power_factor'] < 0.70:
            return 'low_pf'
        elif row['power_factor'] > 0.95:
            return 'high_pf'
    return 'normal'

df['anomaly_type'] = df.apply(label_anomaly, axis=1)

# --- Drop non-feature columns ---
df.drop(columns=['timestamp', 'batch_id'], inplace=True)

# --- Encode target ---
le = LabelEncoder()
df['anomaly_type_encoded'] = le.fit_transform(df['anomaly_type'])

# --- Define features and target ---
X = df.drop(columns=['anomaly_type', 'anomaly_type_encoded'])
y = df['anomaly_type_encoded']

# --- Train-test split ---
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)

# --- Train XGBoost Classifier ---
model = XGBClassifier(use_label_encoder=False, eval_metric='mlogloss')
model.fit(X_train, y_train)

# --- Predictions ---
y_pred = model.predict(X_test)

# --- Evaluation ---
print("Classification Report:")
print(classification_report(y_test, y_pred, target_names=le.classes_))
print("Confusion Matrix:")
print(confusion_matrix(y_test, y_pred))

# --- Prescription mapping ---
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
        'cause': 'Load imbalance & capacitor failure',
        'solution': 'Improve load distribution & replace capacitors'
    },
    'normal': {
        'possible_reason': '—',
        'cause': '—',
        'solution': 'No action needed, System operating Normally'
    }
}

# --- Show some prediction results with prescriptions ---
print("\nSample predictions with prescription:")
results = pd.DataFrame({
    'Predicted_Label': le.inverse_transform(y_pred[:10])
})

for label in results['Predicted_Label']:
    pres = prescription_map[label]
    print(f"\nAnomaly: {label}")
    print(f"Possible Reason: {pres['possible_reason']}")
    print(f"Cause: {pres['cause']}")
    print(f"Solution: {pres['solution']}")

# print(df[df['anomaly_type'] == 'power_drop'].describe())
# print(df[df['anomaly_type'] == 'power_drop'][['power_kw', 'power_factor', 'furnace_temperature', 
#                                               'melting_batch_time', 'energy_reading_pm']].head(10))
# sample = df[df['anomaly_type'] == 'power_drop'].iloc[0].drop(['anomaly_type', 'anomaly_type_encoded'])
# pred = model.predict(pd.DataFrame([sample]))
# print(le.inverse_transform(pred))

import joblib

# --- Save the model ---
joblib.dump(model, 'xgb_anomaly_model.pkl')

# --- Save the label encoder ---
joblib.dump(le, 'label_encoder.pkl')

