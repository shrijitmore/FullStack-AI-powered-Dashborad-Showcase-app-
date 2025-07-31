import express from 'express';
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();
const router = express.Router();
const uri = process.env.MONGODB_URI;

// Real-time data endpoint
router.get('/data', async (req, res) => {
    const client = new MongoClient(uri);
    try {
        await client.connect();
        const database = client.db('test');
        const collection = database.collection('EnergyMonitoring');

        // Get the latest data
        const latestData = await collection.find().sort({ Date: -1 }).limit(1).toArray();
        
        if (latestData.length === 0) {
            return res.status(404).json({ message: 'No data found' });
        }

        const data = latestData[0];
        res.json({
            prediction: "Normal",
            prescription: {
                possible_reason: "System operating within normal parameters",
                cause: "No anomalies detected",
                solution: "Continue monitoring"
            },
            history: [{
                timestamp: data.Date,
                power_kw: data.KWH_Tonne || 0,
                power_factor: data.PF || 0,
                label: "Normal"
            }],
            anomaly_counter: {
                "Normal": 1
            },
            total_consumption: data.KWH_Tonne || 0,
            current_timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error fetching real-time data:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    } finally {
        await client.close();
    }
});

// Historical data endpoint
router.get('/historical_data', async (req, res) => {
    const client = new MongoClient(uri);
    try {
        await client.connect();
        const database = client.db('test');
        const collection = database.collection('EnergyMonitoring');

        // Get data for the last 30 days
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const data = await collection.find({
            Date: { $gte: thirtyDaysAgo.toISOString() }
        }).toArray();

        // Process data into required format
        const daily = data.map(item => ({
            date: item.Date,
            y: item.KWH_Tonne || 0,
            anomaly_intensity: 0
        }));

        // Group by month and week
        const monthly = [];
        const weekly = [];
        const months = {};
        const weeks = {};

        data.forEach(item => {
            const date = new Date(item.Date);
            const monthKey = `${date.getFullYear()}-${date.getMonth() + 1}`;
            const weekKey = `${date.getFullYear()}-W${Math.ceil((date.getDate() + date.getDay()) / 7)}`;

            if (!months[monthKey]) {
                months[monthKey] = { total: 0, count: 0 };
            }
            if (!weeks[weekKey]) {
                weeks[weekKey] = { total: 0, count: 0 };
            }

            months[monthKey].total += item.KWH_Tonne || 0;
            months[monthKey].count++;
            weeks[weekKey].total += item.KWH_Tonne || 0;
            weeks[weekKey].count++;
        });

        Object.entries(months).forEach(([month, data]) => {
            monthly.push({
                month,
                consumption: data.total / data.count
            });
        });

        Object.entries(weeks).forEach(([week, data]) => {
            weekly.push({
                week,
                week_label: `Week ${week.split('-W')[1]}`,
                consumption: data.total / data.count
            });
        });

        res.json({ monthly, weekly, daily });
    } catch (error) {
        console.error('Error fetching historical data:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    } finally {
        await client.close();
    }
});

// Batch data endpoint
router.get('/batch_data', async (req, res) => {
    const client = new MongoClient(uri);
    try {
        await client.connect();
        const database = client.db('test');
        const collection = database.collection('EnergyMonitoring');

        // Get data grouped by batch
        const batchData = await collection.aggregate([
            {
                $group: {
                    _id: "$Batch ID",
                    consumption: { $sum: "$KWH_Tonne" },
                    total_anomalies: { $sum: { $cond: [{ $eq: ["$Anomaly", true] }, 1, 0] } }
                }
            },
            {
                $project: {
                    batch_id: "$_id",
                    consumption: 1,
                    total_anomalies: 1,
                    _id: 0
                }
            }
        ]).toArray();

        res.json({ batches: batchData });
    } catch (error) {
        console.error('Error fetching batch data:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    } finally {
        await client.close();
    }
});

// Test results endpoint
router.get('/test_results', async (req, res) => {
    const client = new MongoClient(uri);
    try {
        await client.connect();
        const database = client.db('test');
        const collection = database.collection('EnergyMonitoring');

        // Get the last 24 hours of data
        const twentyFourHoursAgo = new Date();
        twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

        const data = await collection.find({
            Date: { $gte: twentyFourHoursAgo.toISOString() }
        }).toArray();

        const results = data.map(item => ({
            timestamp: item.Date,
            y: item.KWH_Tonne || 0,
            yhat: item.KWH_Tonne ? item.KWH_Tonne * 0.95 : 0 // Simple prediction for demonstration
        }));

        res.json({ results });
    } catch (error) {
        console.error('Error fetching test results:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    } finally {
        await client.close();
    }
});

// Forecast endpoint
router.post('/forecast', async (req, res) => {
    const { start_date, end_date, production, anomaly_intensity } = req.body;
    
    // Generate sample forecast data
    const forecast = [];
    const start = new Date(start_date);
    const end = new Date(end_date);
    
    for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
        const isMonthEnd = date.getDate() === new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
        
        forecast.push({
            date: date.toISOString().split('T')[0],
            yhat: production * (0.8 + Math.random() * 0.4),
            yhat_lower: production * 0.7,
            yhat_upper: production * 1.2,
            anomaly_intensity: anomaly_intensity,
            is_month_end: isMonthEnd
        });
    }

    res.json({ forecast });
});

export default router; 