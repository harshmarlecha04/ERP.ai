-- Step 1: Insert Sample Customers
INSERT INTO public.customers (customer_name, customer_code, email, phone, is_rd_customer, notes)
VALUES
  ('Wellness Retail Co', 'WRC-001', 'orders@wellnessretail.com', '555-0101', false, 'Monthly subscription customer'),
  ('Natural Health Distributors', 'NHD-002', 'purchasing@naturalhealthdist.com', '555-0102', false, 'Seasonal buyer - peaks in Jan/Sept'),
  ('GreenLife Pharmacy', 'GLP-003', 'buyers@greenlifepharmacy.com', '555-0103', false, 'Steady volume across all products'),
  ('Organic Market Chain', 'OMC-004', 'supply@organicmarket.com', '555-0104', false, 'New partnership - started Aug 2024'),
  ('Holistic Health Partners', 'HHP-005', 'orders@holistichealth.com', '555-0105', false, 'Large quarterly orders')
ON CONFLICT (customer_code) DO NOTHING;

-- Step 2: Insert Historical Customer Orders (Past 12 Months)
-- GG006 (Seamoss & Mushroom) - Increasing trend (35 orders)
INSERT INTO public.customer_orders (customer_id, formula_id, bottle_size, bottles_ordered, due_date, priority, status, notes, order_type)
SELECT 
  c.id,
  '525bf96d-b21d-4cb1-9236-9d7224e370cd'::uuid,
  60,
  CASE 
    WHEN o.month IN (1,2,3) THEN 250 + (random() * 100)::int
    WHEN o.month IN (4,5,6) THEN 300 + (random() * 150)::int
    WHEN o.month IN (7,8,9) THEN 400 + (random() * 200)::int
    ELSE 500 + (random() * 300)::int
  END,
  ('2024-' || LPAD(o.month::text, 2, '0') || '-' || LPAD((15 + (random() * 14)::int)::text, 2, '0'))::date,
  CASE WHEN random() > 0.8 THEN 'high' ELSE 'normal' END,
  CASE 
    WHEN random() > 0.15 THEN 'completed'
    WHEN random() > 0.5 THEN 'in_production'
    ELSE 'pending'
  END,
  'Historical order - ' || c.customer_name,
  'production'
FROM 
  (SELECT id, customer_name, customer_code FROM public.customers WHERE customer_code IN ('WRC-001', 'NHD-002', 'GLP-003', 'OMC-004', 'HHP-005')) c,
  (SELECT generate_series(1, 12) AS month) o
WHERE 
  (c.customer_code = 'WRC-001' AND o.month IN (1,2,3,4,5,6,7,8,9,10,11,12)) OR
  (c.customer_code = 'NHD-002' AND o.month IN (1,2,4,6,8,9,10,12)) OR
  (c.customer_code = 'GLP-003' AND o.month IN (2,4,5,7,9,11)) OR
  (c.customer_code = 'OMC-004' AND o.month IN (8,9,10,11,12)) OR
  (c.customer_code = 'HHP-005' AND o.month IN (3,6,9,12));

-- PV013 (ACV + Ginger) - Stable trend (25 orders)
INSERT INTO public.customer_orders (customer_id, formula_id, bottle_size, bottles_ordered, due_date, priority, status, notes, order_type)
SELECT 
  c.id,
  'c7f7ec92-b282-44f7-bd68-2cd6fa7f3a19'::uuid,
  60,
  280 + (random() * 120)::int,
  ('2024-' || LPAD(o.month::text, 2, '0') || '-' || LPAD((20 + (random() * 9)::int)::text, 2, '0'))::date,
  'normal',
  CASE 
    WHEN random() > 0.1 THEN 'completed'
    ELSE 'in_production'
  END,
  'Stable demand - ' || c.customer_name,
  'production'
FROM 
  (SELECT id, customer_name, customer_code FROM public.customers WHERE customer_code IN ('WRC-001', 'GLP-003', 'HHP-005')) c,
  (SELECT generate_series(1, 12) AS month) o
WHERE 
  (c.customer_code = 'WRC-001' AND o.month IN (1,3,5,7,9,11)) OR
  (c.customer_code = 'GLP-003' AND o.month IN (1,2,4,6,8,10,12)) OR
  (c.customer_code = 'HHP-005' AND o.month IN (2,5,8,11));

-- GG005 (Magnesium & L-Theanine) - Decreasing trend (18 orders)
INSERT INTO public.customer_orders (customer_id, formula_id, bottle_size, bottles_ordered, due_date, priority, status, notes, order_type)
SELECT 
  c.id,
  '0fee5e42-f8a3-44e5-8691-83bfe2158aec'::uuid,
  60,
  CASE 
    WHEN o.month IN (1,2,3) THEN 320 + (random() * 80)::int
    WHEN o.month IN (4,5,6) THEN 280 + (random() * 70)::int
    WHEN o.month IN (7,8,9) THEN 220 + (random() * 60)::int
    ELSE 150 + (random() * 50)::int
  END,
  ('2024-' || LPAD(o.month::text, 2, '0') || '-' || LPAD((18 + (random() * 11)::int)::text, 2, '0'))::date,
  'normal',
  'completed',
  'Declining demand - ' || c.customer_name,
  'production'
FROM 
  (SELECT id, customer_name, customer_code FROM public.customers WHERE customer_code IN ('NHD-002', 'GLP-003')) c,
  (SELECT generate_series(1, 12) AS month) o
WHERE 
  (c.customer_code = 'NHD-002' AND o.month IN (1,2,4,6,8,10,11,12)) OR
  (c.customer_code = 'GLP-003' AND o.month IN (1,3,5,7,9,11));

-- GG013 (B6 + Melatonin) - Seasonal trend (22 orders)
INSERT INTO public.customer_orders (customer_id, formula_id, bottle_size, bottles_ordered, due_date, priority, status, notes, order_type)
SELECT 
  c.id,
  '8f1ea7f9-9e24-4b1b-bbf9-4d7ecd38e78c'::uuid,
  60,
  CASE 
    WHEN o.month IN (11,12,1,2) THEN 350 + (random() * 150)::int
    WHEN o.month IN (3,4,9,10) THEN 250 + (random() * 100)::int
    ELSE 180 + (random() * 70)::int
  END,
  ('2024-' || LPAD(o.month::text, 2, '0') || '-' || LPAD((22 + (random() * 7)::int)::text, 2, '0'))::date,
  CASE WHEN o.month IN (11,12,1,2) THEN 'high' ELSE 'normal' END,
  CASE 
    WHEN random() > 0.12 THEN 'completed'
    ELSE 'in_production'
  END,
  'Seasonal sleep product - ' || c.customer_name,
  'production'
FROM 
  (SELECT id, customer_name, customer_code FROM public.customers WHERE customer_code IN ('WRC-001', 'NHD-002', 'GLP-003', 'OMC-004')) c,
  (SELECT generate_series(1, 12) AS month) o
WHERE 
  (c.customer_code = 'WRC-001' AND o.month IN (1,2,11,12)) OR
  (c.customer_code = 'NHD-002' AND o.month IN (1,3,9,10,11,12)) OR
  (c.customer_code = 'GLP-003' AND o.month IN (2,4,10,11)) OR
  (c.customer_code = 'OMC-004' AND o.month IN (11,12));

-- Step 3: Insert Demand Forecasts (Next 3 Months)
INSERT INTO public.demand_forecasts (formula_id, forecast_month, forecasted_bottles, forecasted_batches, confidence_score, trend)
VALUES
  -- GG006 (Seamoss & Mushroom) - Increasing
  ('525bf96d-b21d-4cb1-9236-9d7224e370cd', '2025-01-01', 450, 3, 0.85, 'increasing'),
  ('525bf96d-b21d-4cb1-9236-9d7224e370cd', '2025-02-01', 520, 4, 0.85, 'increasing'),
  ('525bf96d-b21d-4cb1-9236-9d7224e370cd', '2025-03-01', 600, 4, 0.82, 'increasing'),
  
  -- PV013 (ACV + Ginger) - Stable
  ('c7f7ec92-b282-44f7-bd68-2cd6fa7f3a19', '2025-01-01', 300, 2, 0.90, 'stable'),
  ('c7f7ec92-b282-44f7-bd68-2cd6fa7f3a19', '2025-02-01', 310, 2, 0.90, 'stable'),
  ('c7f7ec92-b282-44f7-bd68-2cd6fa7f3a19', '2025-03-01', 305, 2, 0.88, 'stable'),
  
  -- GG005 (Magnesium & L-Theanine) - Decreasing
  ('0fee5e42-f8a3-44e5-8691-83bfe2158aec', '2025-01-01', 200, 1, 0.75, 'decreasing'),
  ('0fee5e42-f8a3-44e5-8691-83bfe2158aec', '2025-02-01', 180, 1, 0.75, 'decreasing'),
  ('0fee5e42-f8a3-44e5-8691-83bfe2158aec', '2025-03-01', 160, 1, 0.72, 'decreasing'),
  
  -- GG013 (B6 + Melatonin) - Seasonal (declining after winter)
  ('8f1ea7f9-9e24-4b1b-bbf9-4d7ecd38e78c', '2025-01-01', 380, 3, 0.88, 'stable'),
  ('8f1ea7f9-9e24-4b1b-bbf9-4d7ecd38e78c', '2025-02-01', 350, 2, 0.85, 'stable'),
  ('8f1ea7f9-9e24-4b1b-bbf9-4d7ecd38e78c', '2025-03-01', 250, 2, 0.80, 'decreasing');

-- Step 4: Insert Demand Anomalies (3 alerts) - using correct column names
INSERT INTO public.demand_anomalies (formula_id, anomaly_month, expected_orders, actual_orders, variance_percent, severity, acknowledged, acknowledged_at, notes)
VALUES
  -- Critical: GG005 underperformance (orders, not bottles)
  ('0fee5e42-f8a3-44e5-8691-83bfe2158aec', '2024-12-01', 4, 2, -50.0, 'critical', false, NULL, NULL),
  
  -- Warning: PV013 below forecast
  ('c7f7ec92-b282-44f7-bd68-2cd6fa7f3a19', '2024-12-01', 5, 4, -20.0, 'warning', false, NULL, NULL),
  
  -- Exceeding: GG006 above forecast (acknowledged)
  ('525bf96d-b21d-4cb1-9236-9d7224e370cd', '2024-11-01', 8, 11, 37.5, 'exceeding', true, '2024-11-20 10:30:00', 'New retail partnership with Organic Market Chain signed in November. They placed a large launch order.');

-- Step 5: Insert Safety Stock Recommendations
INSERT INTO public.safety_stock_recommendations (raw_material_id, recommended_min_kg, recommended_reorder_kg, based_on_months_data, confidence_score, avg_daily_usage_kg, max_daily_usage_kg, usage_variability)
VALUES
  -- Cyanocobalamin B12
  ('fb4744a1-806f-4920-90e6-e45b3c36eecc', 15.0, 25.0, 6, 0.80, 0.36, 0.65, 35.2),
  
  -- Vitamin D3
  ('824fccf9-5f31-4a52-8011-0999fa37edcc', 10.0, 18.0, 6, 0.88, 0.26, 0.42, 18.4),
  
  -- Organic Beet Root Powder
  ('d2433c15-bb39-4dca-b402-fc1459143996', 30.0, 50.0, 6, 0.92, 0.74, 1.10, 12.8),
  
  -- Tapioca Organic Syrup
  ('379970e2-00be-43bf-9542-05946ce715a4', 75.0, 125.0, 6, 0.95, 1.79, 2.45, 8.3),
  
  -- Pyridoxine HCL (Vitamin B6)
  ('fa2479f2-769f-4c5d-b57a-ca7894086af4', 8.0, 15.0, 6, 0.85, 0.19, 0.35, 22.5);