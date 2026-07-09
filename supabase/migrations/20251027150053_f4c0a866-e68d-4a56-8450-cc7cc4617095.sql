-- Delete orders for GreenLife Pharmacy (child records first)
DELETE FROM order_headers 
WHERE customer_id = '61d7d445-971b-43d3-b510-89719fa226a0';

-- Delete the GreenLife Pharmacy customer (parent record)
DELETE FROM customers 
WHERE id = '61d7d445-971b-43d3-b510-89719fa226a0';