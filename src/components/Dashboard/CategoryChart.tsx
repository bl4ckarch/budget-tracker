import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

interface CategoryData {
  category: string;
  type: string;
  spent: number;
  budget: number;
  percentage: number;
  color?: string;
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
      color: item.color || getColorByCategory(item.category)
    }));

  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
    }).format(value);
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length > 0) {
      const data = payload[0];
      return React.createElement('div', {
        className: "bg-white dark:bg-gray-800 p-3 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg"
      }, [
        React.createElement('p', {
          key: 'name',
          className: "text-sm font-medium text-gray-900 dark:text-white"
        }, data.name),
        React.createElement('p', {
          key: 'value',
          className: "text-sm text-gray-600 dark:text-gray-400"
        }, formatCurrency(data.value))
      ]);
    }
    return null;
  };

  if (expenseData.length === 0) {
    return React.createElement('div', {
      className: "bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700"
    }, [
      React.createElement('h3', {
        key: 'title',
        className: "text-lg font-semibold text-gray-900 dark:text-white mb-4"
      }, "Répartition des dépenses"),
      React.createElement('div', {
        key: 'empty',
        className: "flex items-center justify-center h-64"
      }, React.createElement('p', {
        className: "text-gray-500 dark:text-gray-400"
      }, "Aucune dépense enregistrée ce mois-ci"))
    ]);
  }

  return React.createElement('div', {
    className: "bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700"
  }, [
    React.createElement('h3', {
      key: 'title',
      className: "text-lg font-semibold text-gray-900 dark:text-white mb-4"
    }, "Répartition des dépenses"),
    React.createElement('div', {
      key: 'chart',
      className: "h-64"
    }, React.createElement(ResponsiveContainer, {
      width: "100%",
      height: "100%"
    }, React.createElement(PieChart, {}, [
      React.createElement(Pie, {
        key: 'pie',
        data: expenseData,
        cx: "50%",
        cy: "50%",
        innerRadius: 60,
        outerRadius: 80,
        paddingAngle: 5,
        dataKey: "value"
      }, expenseData.map((entry, index) => 
        React.createElement(Cell, {
          key: `cell-${index}`,
          fill: entry.color
        })
      )),
      React.createElement(Tooltip, {
        key: 'tooltip',
        content: React.createElement(CustomTooltip, {})
      }),
      React.createElement(Legend, {
        key: 'legend',
        formatter: (value: string) => React.createElement('span', {
          className: "text-sm text-gray-700 dark:text-gray-300"
        }, value)
      })
    ])))
  ]);
};

const getColorByCategory = (category: string): string => {
  const colors: { [key: string]: string } = {
    'Logement': '#ef4444',
    'Alimentation': '#f97316',
    'Transport': '#eab308',
    'Loisirs': '#22c55e',
    'Crédit Auto': '#8b5cf6',
    'Assurance Auto': '#8b5cf6',
    'Assurance': '#06b6d4',
    'Téléphone/Internet': '#3b82f6',
    'Santé': '#ec4899',
    'Vêtements': '#84cc16',
    'Divers': '#6b7280'
  };
  return colors[category] || '#6b7280';
};

export default CategoryChart;