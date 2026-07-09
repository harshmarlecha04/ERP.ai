-- Delete orders for test customers first (child records)
DELETE FROM order_headers 
WHERE customer_id IN (
  SELECT id FROM customers 
  WHERE customer_name IN (
    'Holistic Health Partners',
    'Natural Health Distributors',
    'Organic Market Chain',
    'Wellness Retail Co'
  )
);

-- Delete the test customers (parent records)
DELETE FROM customers 
WHERE customer_name IN (
  'Holistic Health Partners',
  'Natural Health Distributors',
  'Organic Market Chain',
  'Wellness Retail Co'
);