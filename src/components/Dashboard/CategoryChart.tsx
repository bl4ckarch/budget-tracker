import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

interface CategoryData {
  category: string;
  type: string;
  spent: number;
  budget: number;
  percentage: number;
}

interface CategoryChartProps {
  data: CategoryData[];
}

const CategoryChart: React.FC<CategoryChartProps> = ({ data }) => {
  const expenseData = data
    .filter(item => item.type !== 'income' && item.type !== 'savings' && item.spent > 0)
    .map(item => ({
      name: item.category,
      value: item.spent,
      color: getColorByCategory(item.category)
    }));

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
    }).format(value);
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0];
      return (
        <div className="bg-white dark:bg-gray-800 p-3 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg">
          <p className="text-sm font-medium text-gray-900 dark:text-white">
            {data.name}
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {formatCurrency(data.value)}
          </p>
        </div>
      );
    }
    return null;
  };

  if (expenseData.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Répartition des dépenses
        </h3>
        <div className="flex items-center justify-center h-64">
          <p className="text-gray-500 dark:text-gray-400">Aucune dépense enregistrée ce mois-ci</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        Répartition des dépenses
      </h3>
      
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={expenseData}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={80}
              paddingAngle={5}
              dataKey="value"
            >
              {expenseData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend 
              formatter={(value) => (
                <span className="text-sm text-gray-700 dark:text-gray-300">{value}</span>
              )}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

const getColorByCategory = (category: string): string => {
  const colors: { [key: string]: string } = {
    'Logement': '#ef4444',
    'Alimentation': '#f97316',
    'Transport': '#eab308',
    'Loisirs': '#22c55e',
    'Crédit Auto': '#8b5cf6',
    'Assurance': '#06b6d4',
  };
  
  return colors[category] || '#6b7280';
};

export default CategoryChart;