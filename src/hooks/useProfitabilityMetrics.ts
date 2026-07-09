// Hook providing sample data for profitability dashboard
// This will be replaced with real database queries later

export interface ProfitabilityMetrics {
  totalCOGS: number;
  avgCostPerUnit: number;
  grossMarginPercent: number;
  totalVariance: number;
  costBreakdown: {
    material: number;
    labor: number;
    overhead: number;
    packaging: number;
  };
  cogsTrend: Array<{
    month: string;
    material: number;
    labor: number;
    overhead: number;
    packaging: number;
    total: number;
  }>;
  productPerformance: Array<{
    formulaCode: string;
    formulaName: string;
    batches: number;
    actualCost: number;
    standardCost: number;
    variance: number;
    variancePercent: number;
  }>;
  costVariances: Array<{
    formulaCode: string;
    formulaName: string;
    batches: number;
    actualCost: number;
    standardCost: number;
    varianceDollar: number;
    variancePercent: number;
  }>;
}

export const useProfitabilityMetrics = () => {
  // Sample data - this will be replaced with real data from Supabase
  const metrics: ProfitabilityMetrics = {
    totalCOGS: 187450.00,
    avgCostPerUnit: 2.34,
    grossMarginPercent: 42.5,
    totalVariance: -8234.50, // Negative means over budget
    
    costBreakdown: {
      material: 112470.00, // 60%
      labor: 37490.00,     // 20%
      overhead: 28117.50,  // 15%
      packaging: 9372.50   // 5%
    },
    
    cogsTrend: [
      {
        month: 'Sep',
        material: 98500,
        labor: 32000,
        overhead: 24000,
        packaging: 8000,
        total: 162500
      },
      {
        month: 'Oct',
        material: 105200,
        labor: 34500,
        overhead: 25800,
        packaging: 8600,
        total: 174100
      },
      {
        month: 'Nov',
        material: 108900,
        labor: 35800,
        overhead: 26850,
        packaging: 8950,
        total: 180500
      },
      {
        month: 'Dec',
        material: 110300,
        labor: 36200,
        overhead: 27150,
        packaging: 9050,
        total: 182700
      },
      {
        month: 'Jan',
        material: 111800,
        labor: 37100,
        overhead: 27825,
        packaging: 9275,
        total: 186000
      },
      {
        month: 'Feb',
        material: 112470,
        labor: 37490,
        overhead: 28117.50,
        packaging: 9372.50,
        total: 187450
      }
    ],
    
    productPerformance: [
      {
        formulaCode: 'VD3-60',
        formulaName: 'Vitamin D3 60ct',
        batches: 12,
        actualCost: 45200,
        standardCost: 42000,
        variance: 3200,
        variancePercent: 7.6
      },
      {
        formulaCode: 'OM3-30',
        formulaName: 'Omega-3 30ct',
        batches: 8,
        actualCost: 38900,
        standardCost: 36000,
        variance: 2900,
        variancePercent: 8.1
      },
      {
        formulaCode: 'MV-90',
        formulaName: 'Multivitamin 90ct',
        batches: 15,
        actualCost: 52300,
        standardCost: 54000,
        variance: -1700,
        variancePercent: -3.1
      },
      {
        formulaCode: 'BIO-60',
        formulaName: 'Biotin 60ct',
        batches: 10,
        actualCost: 28450,
        standardCost: 30000,
        variance: -1550,
        variancePercent: -5.2
      },
      {
        formulaCode: 'VC-120',
        formulaName: 'Vitamin C 120ct',
        batches: 6,
        actualCost: 22600,
        standardCost: 24000,
        variance: -1400,
        variancePercent: -5.8
      }
    ],
    
    costVariances: [
      {
        formulaCode: 'OM3-30',
        formulaName: 'Omega-3 30ct',
        batches: 8,
        actualCost: 38900,
        standardCost: 36000,
        varianceDollar: 2900,
        variancePercent: 8.1
      },
      {
        formulaCode: 'VD3-60',
        formulaName: 'Vitamin D3 60ct',
        batches: 12,
        actualCost: 45200,
        standardCost: 42000,
        varianceDollar: 3200,
        variancePercent: 7.6
      },
      {
        formulaCode: 'MV-90',
        formulaName: 'Multivitamin 90ct',
        batches: 15,
        actualCost: 52300,
        standardCost: 54000,
        varianceDollar: -1700,
        variancePercent: -3.1
      },
      {
        formulaCode: 'BIO-60',
        formulaName: 'Biotin 60ct',
        batches: 10,
        actualCost: 28450,
        standardCost: 30000,
        varianceDollar: -1550,
        variancePercent: -5.2
      },
      {
        formulaCode: 'VC-120',
        formulaName: 'Vitamin C 120ct',
        batches: 6,
        actualCost: 22600,
        standardCost: 24000,
        varianceDollar: -1400,
        variancePercent: -5.8
      }
    ]
  };

  return {
    metrics,
    isLoading: false,
    error: null
  };
};
