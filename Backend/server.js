import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import cors from 'cors';
import energyMonitoringRoutes from './routes/energyMonitoring.js';
import energyOptimizationRoutes from './routes/energyOptimization.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json()); 

// Configure CORS with specific options
app.use(cors());

// MongoDB Connection with more detailed error logging
mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    console.log('MongoDB connected successfully');
  })
  .catch(err => {
    console.error('MongoDB connection error:', err);
  });

// Use the routes
app.use('/', energyMonitoringRoutes);
app.use('/', energyOptimizationRoutes);

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});