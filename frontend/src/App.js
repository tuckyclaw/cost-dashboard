import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { format, subDays, subWeeks, subMonths } from 'date-fns';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import DatePicker from 'react-datepicker';
import Select from 'react-select';
import "react-datepicker/dist/react-datepicker.css";

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

function App() {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [trends, setTrends] = useState([]);
  const [models, setModels] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [daily, setDaily] = useState([]);
  const [timeRange, setTimeRange] = useState('week');
  const [startDate, setStartDate] = useState(subWeeks(new Date(), 1));
  const [endDate, setEndDate] = useState(new Date());
  const [selectedModel, setSelectedModel] = useState(null);
  const [selectedTask, setSelectedTask] = useState(null);

  // Colores para gráficos
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

  // Cargar datos
  useEffect(() => {
    fetchData();
  }, [timeRange, startDate, endDate, selectedModel, selectedTask]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Parámetros de consulta
      const params = new URLSearchParams();
      if (timeRange !== 'custom') {
        params.append('timeRange', timeRange);
      } else {
        params.append('startDate', format(startDate, 'yyyy-MM-dd'));
        params.append('endDate', format(endDate, 'yyyy-MM-dd'));
      }

      // Cargar todos los datos en paralelo
      const [
        summaryRes,
        trendsRes,
        modelsRes,
        tasksRes,
        dailyRes
      ] = await Promise.all([
        axios.get(`${API_BASE}/summary?${params}`),
        axios.get(`${API_BASE}/trends?groupBy=day&${params}`),
        axios.get(`${API_BASE}/models?${params}`),
        axios.get(`${API_BASE}/tasks?${params}`),
        axios.get(`${API_BASE}/daily?limit=30`)
      ]);

      setSummary(summaryRes.data);
      setTrends(trendsRes.data.trends || []);
      setModels(modelsRes.data.models || []);
      setTasks(tasksRes.data.tasks || []);
      setDaily(dailyRes.data.daily_summaries || []);
    } catch (error) {
      console.error('Error cargando datos:', error);
    } finally {
      setLoading(false);
    }
  };

  // Formatear moneda
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 4
    }).format(amount || 0);
  };

  // Formatear número
  const formatNumber = (num) => {
    return new Intl.NumberFormat('en-US').format(num || 0);
  };

  // Opciones de rango de tiempo
  const timeRangeOptions = [
    { value: 'hour', label: 'Última hora' },
    { value: 'day', label: 'Último día' },
    { value: 'week', label: 'Última semana' },
    { value: 'month', label: 'Último mes' },
    { value: 'custom', label: 'Personalizado' }
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="spinner mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando métricas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Cost Dashboard - OpenClaw</h1>
              <p className="text-gray-600">Monitoreo de gastos y utilización de modelos</p>
            </div>
            <div className="mt-4 sm:mt-0 flex items-center space-x-4">
              <Select
                options={timeRangeOptions}
                value={timeRangeOptions.find(opt => opt.value === timeRange)}
                onChange={(opt) => setTimeRange(opt.value)}
                className="w-48"
              />
              {timeRange === 'custom' && (
                <div className="flex items-center space-x-2">
                  <DatePicker
                    selected={startDate}
                    onChange={setStartDate}
                    selectsStart
                    startDate={startDate}
                    endDate={endDate}
                    className="border rounded px-3 py-1"
                  />
                  <span>a</span>
                  <DatePicker
                    selected={endDate}
                    onChange={setEndDate}
                    selectsEnd
                    startDate={startDate}
                    endDate={endDate}
                    minDate={startDate}
                    className="border rounded px-3 py-1"
                  />
                </div>
              )}
              <button
                onClick={fetchData}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
              >
                Actualizar
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Resumen General */}
        {summary && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Costo Total</h3>
              <p className="text-3xl font-bold text-blue-600">
                {formatCurrency(summary.total_cost)}
              </p>
              <p className="text-sm text-gray-500 mt-2">
                {formatNumber(summary.total_tokens)} tokens
              </p>
            </div>
            
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Tareas</h3>
              <p className="text-3xl font-bold text-green-600">
                {formatNumber(summary.tasks_by_category?.reduce((acc, task) => acc + task.count, 0) || 0)}
              </p>
              <p className="text-sm text-gray-500 mt-2">
                {summary.tasks_by_category?.length || 0} categorías
              </p>
            </div>
            
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Modelos Usados</h3>
              <p className="text-3xl font-bold text-purple-600">
                {summary.top_models?.length || 0}
              </p>
              <p className="text-sm text-gray-500 mt-2">
                {summary.top_models?.[0]?.model || 'N/A'} más usado
              </p>
            </div>
            
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Período</h3>
              <p className="text-3xl font-bold text-yellow-600">
                {timeRange === 'custom' ? 'Personalizado' : timeRangeOptions.find(opt => opt.value === timeRange)?.label}
              </p>
              <p className="text-sm text-gray-500 mt-2">
                {summary.date_range?.start} a {summary.date_range?.end}
              </p>
            </div>
          </div>
        )}

        {/* Gráficos */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Tendencias de Costo */}
          <div className="card">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Tendencias de Costo</h3>
              <div className="text-sm text-gray-500 bg-gray-50 px-3 py-1 rounded">
                <span className="inline-block w-3 h-3 bg-blue-500 rounded-full mr-1"></span>
                Costo Total (USD) | 
                <span className="inline-block w-3 h-3 bg-green-500 rounded-full mx-1 ml-3"></span>
                Número de Tareas
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Muestra la evolución del costo (eje izquierdo) y volumen de tareas (eje derecho) a lo largo del tiempo.
            </p>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trends}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="period" />
                  <YAxis label={{ value: 'Costo (USD)', angle: -90, position: 'insideLeft' }} />
                  <YAxis yAxisId={1} orientation="right" label={{ value: 'Tareas', angle: 90, position: 'insideRight' }} />
                  <Tooltip 
                    formatter={(value, name) => {
                      if (name === 'Costo Total') return [formatCurrency(value), 'Costo'];
                      return [value, 'Tareas'];
                    }}
                    labelFormatter={(label) => `Fecha: ${label}`}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="total_cost" stroke="#3b82f6" name="Costo Total (USD)" strokeWidth={2} />
                  <Line type="monotone" dataKey="task_count" stroke="#10b981" name="Tareas" yAxisId={1} strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Distribución por Modelo */}
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Costo por Modelo</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={models.slice(0, 6).map(m => ({...m, name: `${m.model} (${m.provider})`}))}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="total_cost"
                  >
                    {models.slice(0, 6).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value) => [formatCurrency(value), 'Costo']}
                    labelFormatter={(label) => `Modelo: ${label}`}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Tablas Detalladas */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Top Modelos */}
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Modelos por Costo</h3>
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Modelo</th>
                    <th>Proveedor</th>
                    <th>Tareas</th>
                    <th>Tokens</th>
                    <th>Costo</th>
                  </tr>
                </thead>
                <tbody>
                  {models.slice(0, 10).map((model, index) => (
                    <tr key={index}>
                      <td className="font-medium">{model.model}</td>
                      <td>
                        <span className="badge badge-primary">{model.provider}</span>
                      </td>
                      <td>{formatNumber(model.task_count)}</td>
                      <td>{formatNumber(model.total_input_tokens + model.total_output_tokens)}</td>
                      <td className="font-semibold">{formatCurrency(model.total_cost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Tareas por Categoría */}
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Tareas por Categoría</h3>
            <div className="h-64 mb-6">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={tasks}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="task_category" />
                  <YAxis />
                  <Tooltip 
                    formatter={(value, name) => {
                      if (name === 'Costo') return [formatCurrency(value), 'Costo'];
                      return [value, 'Tareas'];
                    }}
                    labelFormatter={(label) => `Categoría: ${label}`}
                  />
                  <Legend />
                  <Bar dataKey="task_count" fill="#10b981" name="Número de Tareas" />
                  <Bar dataKey="total_cost" fill="#3b82f6" name="Costo Total (USD)" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Categoría</th>
                    <th>Tareas</th>
                    <th>Costo</th>
                    <th>Tokens/Tarea</th>
                    <th>Modelos</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.map((task, index) => (
                    <tr key={index}>
                      <td className="font-medium capitalize">{task.task_category}</td>
                      <td>{formatNumber(task.task_count)}</td>
                      <td className="font-semibold">{formatCurrency(task.total_cost)}</td>
                      <td>{formatNumber(task.avg_tokens_per_task)}</td>
                      <td className="text-sm text-gray-500 truncate max-w-xs">
                        {task.models_used}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Resumen Diario */}
        <div className="card mt-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Resumen Diario (Últimos 30 días)</h3>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Costo Total</th>
                  <th>Tokens</th>
                  <th>Tareas</th>
                  <th>Modelos Usados</th>
                </tr>
              </thead>
              <tbody>
                {daily.map((day, index) => (
                  <tr key={index}>
                    <td className="font-medium">{day.date}</td>
                    <td className="font-semibold">{formatCurrency(day.total_cost)}</td>
                    <td>{formatNumber(day.total_tokens)}</td>
                    <td>{formatNumber(day.tasks_count)}</td>
                    <td className="text-sm text-gray-500">
                      {day.models_used?.split(',').slice(0, 3).join(', ')}
                      {day.models_used?.split(',').length > 3 && '...'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-12 pt-8 border-t border-gray-200 text-center text-gray-500 text-sm">
          <p>Cost Dashboard v1.0 • Actualizado: {format(new Date(), 'PPpp')}</p>
          <p className="mt-2">
            Datos recolectados de sesiones de OpenClaw • 
            <a href="/api/health" className="text-blue-600 hover:text-blue-800 ml-2">
              Ver estado del sistema
            </a>
          </p>
        </footer>
      </main>
    </div>
  );
}

export default App;