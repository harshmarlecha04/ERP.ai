-- Insert sample customer inquiries for Communication Hub testing (with correct constraint values)

-- 1. Zoyava Gummies - New Order (High Urgency)
DO $seed$ BEGIN INSERT INTO customer_inquiries (id, customer_id, customer_name, customer_email, customer_phone, company_name, inquiry_type, subject, message, urgency, status, created_at)
VALUES (
  '11111111-1111-1111-1111-111111111111',
  'e3baf06e-07d7-4f65-896d-ff8a7e9f358b',
  'Sarah Chen',
  'sarah@zoyavagummies.com',
  '+1 (555) 123-4567',
  'Zoyava Gummies',
  'new_order',
  'Bulk Order Request - 50,000 Units',
  'Hi! We need to place a bulk order for 50,000 units of our custom elderberry formula. Our current inventory is running low and we need this by mid-March. Can you confirm availability and timeline?',
  'high',
  'in_review',
  NOW() - INTERVAL '2 days'
); EXCEPTION WHEN foreign_key_violation OR unique_violation THEN NULL; END $seed$;

-- 2. CBDFx - Product Question (Normal Urgency)
DO $seed$ BEGIN INSERT INTO customer_inquiries (id, customer_id, customer_name, customer_email, customer_phone, company_name, inquiry_type, subject, message, urgency, status, created_at)
VALUES (
  '22222222-2222-2222-2222-222222222222',
  'c47060d2-1ef7-4c9a-94ec-fd0f9abff4be',
  'Mike Johnson',
  'mike@cbdfx.com',
  '+1 (555) 234-5678',
  'CBDFx',
  'product_question',
  'Question About Vegan Gummy Options',
  'We are exploring expanding our product line to include fully vegan gummy options. Do you have experience with plant-based gelatin alternatives like pectin or agar? What are the pros and cons?',
  'normal',
  'in_review',
  NOW() - INTERVAL '4 days'
); EXCEPTION WHEN foreign_key_violation OR unique_violation THEN NULL; END $seed$;

-- 3. Pharmvista - Order Status (Low Urgency, Closed)
DO $seed$ BEGIN INSERT INTO customer_inquiries (id, customer_id, customer_name, customer_email, customer_phone, company_name, inquiry_type, subject, message, urgency, status, created_at)
VALUES (
  '33333333-3333-3333-3333-333333333333',
  '7ec83b9f-f9f5-47b6-9d99-a6950d330e1a',
  'Jennifer Martinez',
  'jmartinez@pharmvista.com',
  '+1 (555) 345-6789',
  'Pharmvista',
  'order_status',
  'Invoice Clarification',
  'I received invoice #INV-2024-0892 but the line items don''t match our PO. Can someone review this?',
  'low',
  'closed',
  NOW() - INTERVAL '7 days'
); EXCEPTION WHEN foreign_key_violation OR unique_violation THEN NULL; END $seed$;

-- 4. Lunakai - Order Status (Urgent)
DO $seed$ BEGIN INSERT INTO customer_inquiries (id, customer_id, customer_name, customer_email, customer_phone, company_name, inquiry_type, subject, message, urgency, status, created_at)
VALUES (
  '44444444-4444-4444-4444-444444444444',
  '5dbe3073-df1a-472b-8dc7-3336935ca0b9',
  'David Park',
  'david@lunakai.com',
  '+1 (555) 456-7890',
  'Lunakai',
  'order_status',
  'Quality Issue - Last Shipment',
  'We received our last shipment of 10,000 Elderberry gummies and noticed some discoloration on approximately 5% of the batch. This is concerning as we have strict quality standards. Can you please look into this urgently?',
  'urgent',
  'new',
  NOW() - INTERVAL '1 day'
); EXCEPTION WHEN foreign_key_violation OR unique_violation THEN NULL; END $seed$;

-- 5. New Prospect - General Inquiry (Normal, Unassigned)
DO $seed$ BEGIN INSERT INTO customer_inquiries (id, customer_name, customer_email, customer_phone, company_name, inquiry_type, subject, message, urgency, status, created_at)
VALUES (
  '55555555-5555-5555-5555-555555555555',
  'Emily Rodriguez',
  'emily@healthybites.com',
  '+1 (555) 567-8901',
  'Healthy Bites Co',
  'general',
  'Wholesale Partnership Inquiry',
  'Hello, I represent Healthy Bites Co, a wellness retailer with 15 locations across California. We are interested in exploring a wholesale partnership for private label gummy supplements. Could we schedule a call to discuss?',
  'normal',
  'new',
  NOW() - INTERVAL '5 days'
); EXCEPTION WHEN foreign_key_violation OR unique_violation THEN NULL; END $seed$;

-- 6. GOT Gummies - General (High Urgency)
DO $seed$ BEGIN INSERT INTO customer_inquiries (id, customer_id, customer_name, customer_email, customer_phone, company_name, inquiry_type, subject, message, urgency, status, created_at)
VALUES (
  '66666666-6666-6666-6666-666666666666',
  '271c1ff9-06ab-4bd4-91c6-7f07f8785675',
  'Robert Thompson',
  'robert@gotgummies.com',
  '+1 (555) 678-9012',
  'GOT Gummies',
  'general',
  'Rush Order - Need by End of Week',
  'URGENT: We have an unexpected retail opportunity and need 5,000 units of our standard formula by Friday. I know this is short notice, but is there any way you can accommodate this rush order? Willing to pay expedite fees.',
  'high',
  'in_review',
  NOW() - INTERVAL '6 hours'
); EXCEPTION WHEN foreign_key_violation OR unique_violation THEN NULL; END $seed$;

-- Insert conversation messages for each inquiry

-- Conversation 1: Zoyava Gummies - New Order
DO $seed$ BEGIN INSERT INTO inquiry_messages (inquiry_id, message, sender_type, sender_name, sender_email, is_internal_note, created_at) VALUES
('11111111-1111-1111-1111-111111111111', 'Hi! We need to place a bulk order for 50,000 units of our custom elderberry formula. Our current inventory is running low and we need this by mid-March. Can you confirm availability and timeline?', 'customer', 'Sarah Chen', 'sarah@zoyavagummies.com', false, NOW() - INTERVAL '2 days'),
('11111111-1111-1111-1111-111111111111', 'Hi Sarah! Thank you for reaching out. I''ve reviewed our production schedule and we can definitely accommodate your order. For 50,000 units, we''re looking at a 3-week production timeline. If you approve the quote by end of this week, we can have everything ready by March 15th. I''ll send over a formal quote within the hour.', 'staff', 'Production Team', null, false, NOW() - INTERVAL '2 days' + INTERVAL '2 hours'),
('11111111-1111-1111-1111-111111111111', 'Perfect! March 15th works great for us. Please send the quote and we''ll get it approved quickly.', 'customer', 'Sarah Chen', 'sarah@zoyavagummies.com', false, NOW() - INTERVAL '1 day'),
('11111111-1111-1111-1111-111111111111', 'Quote sent via email. Confirmed raw materials are in stock. This should be a smooth production run.', 'staff', 'Production Team', null, true, NOW() - INTERVAL '1 day' + INTERVAL '30 minutes'); EXCEPTION WHEN foreign_key_violation OR unique_violation THEN NULL; END $seed$;

-- Conversation 2: CBDFx - Product Question
DO $seed$ BEGIN INSERT INTO inquiry_messages (inquiry_id, message, sender_type, sender_name, sender_email, is_internal_note, created_at) VALUES
('22222222-2222-2222-2222-222222222222', 'We are exploring expanding our product line to include fully vegan gummy options. Do you have experience with plant-based gelatin alternatives like pectin or agar? What are the pros and cons?', 'customer', 'Mike Johnson', 'mike@cbdfx.com', false, NOW() - INTERVAL '4 days'),
('22222222-2222-2222-2222-222222222222', 'Hi Mike! Great question. We have extensive experience with both pectin and agar-based gummies. Pectin works wonderfully for fruit-flavored products and has a softer texture. Agar creates a firmer bite, similar to traditional gelatin. The main considerations are: texture preferences, shelf stability (both are excellent), and cost (pectin is slightly more economical). I can send you samples of both if you''d like to compare.', 'staff', 'R&D Team', null, false, NOW() - INTERVAL '3 days'),
('22222222-2222-2222-2222-222222222222', 'Samples would be amazing! We''re leaning toward pectin for our berry line. What''s the MOQ for a test batch?', 'customer', 'Mike Johnson', 'mike@cbdfx.com', false, NOW() - INTERVAL '2 days'),
('22222222-2222-2222-2222-222222222222', 'For R&D test batches, we can do as low as 1,000 units. This gives you enough for internal testing and focus groups without a huge commitment. Let me prepare a proposal.', 'staff', 'R&D Team', null, false, NOW() - INTERVAL '1 day'); EXCEPTION WHEN foreign_key_violation OR unique_violation THEN NULL; END $seed$;

-- Conversation 3: Pharmvista - Order Status (Closed)
DO $seed$ BEGIN INSERT INTO inquiry_messages (inquiry_id, message, sender_type, sender_name, sender_email, is_internal_note, created_at) VALUES
('33333333-3333-3333-3333-333333333333', 'I received invoice #INV-2024-0892 but the line items don''t match our PO. Can someone review this?', 'customer', 'Jennifer Martinez', 'jmartinez@pharmvista.com', false, NOW() - INTERVAL '7 days'),
('33333333-3333-3333-3333-333333333333', 'Hi Jennifer, I apologize for the confusion. I''ve reviewed both documents and found the issue - we accidentally listed the bottle sizes in mL instead of FL OZ on the invoice. The quantities and pricing are correct. I''m issuing a corrected invoice right now with the proper unit labels.', 'staff', 'Billing Team', null, false, NOW() - INTERVAL '7 days' + INTERVAL '1 hour'),
('33333333-3333-3333-3333-333333333333', 'Thank you for the quick response! The corrected invoice looks perfect. Approved for payment.', 'customer', 'Jennifer Martinez', 'jmartinez@pharmvista.com', false, NOW() - INTERVAL '6 days'),
('33333333-3333-3333-3333-333333333333', 'Simple unit conversion error. Updated invoice template to prevent this in future.', 'staff', 'Billing Team', null, true, NOW() - INTERVAL '6 days'); EXCEPTION WHEN foreign_key_violation OR unique_violation THEN NULL; END $seed$;

-- Conversation 4: Lunakai - Quality Complaint
DO $seed$ BEGIN INSERT INTO inquiry_messages (inquiry_id, message, sender_type, sender_name, sender_email, is_internal_note, created_at) VALUES
('44444444-4444-4444-4444-444444444444', 'We received our last shipment of 10,000 Elderberry gummies and noticed some discoloration on approximately 5% of the batch. This is concerning as we have strict quality standards. Can you please look into this urgently?', 'customer', 'David Park', 'david@lunakai.com', false, NOW() - INTERVAL '1 day'),
('44444444-4444-4444-4444-444444444444', 'URGENT - Quality issue reported. Need QA team to review batch #ELD-2024-0892 immediately. Customer sent photos showing purple discoloration on some gummies.', 'staff', 'Customer Success', null, true, NOW() - INTERVAL '1 day' + INTERVAL '15 minutes'),
('44444444-4444-4444-4444-444444444444', 'Hi David, thank you for bringing this to our attention immediately. I''ve escalated this to our QA team for urgent review. Could you please confirm the batch number from your packaging and share photos of the affected gummies? This will help us investigate quickly.', 'staff', 'Quality Assurance', null, false, NOW() - INTERVAL '1 day' + INTERVAL '30 minutes'),
('44444444-4444-4444-4444-444444444444', 'Batch #ELD-2024-0892. I''ve attached photos in a separate email showing the affected gummies. The discoloration appears darker purple/brown on about 500 units.', 'customer', 'David Park', 'david@lunakai.com', false, NOW() - INTERVAL '20 hours'); EXCEPTION WHEN foreign_key_violation OR unique_violation THEN NULL; END $seed$;

-- Conversation 5: Healthy Bites - Partnership (Unassigned)
DO $seed$ BEGIN INSERT INTO inquiry_messages (inquiry_id, message, sender_type, sender_name, sender_email, is_internal_note, created_at) VALUES
('55555555-5555-5555-5555-555555555555', 'Hello, I represent Healthy Bites Co, a wellness retailer with 15 locations across California. We are interested in exploring a wholesale partnership for private label gummy supplements. Could we schedule a call to discuss?', 'customer', 'Emily Rodriguez', 'emily@healthybites.com', false, NOW() - INTERVAL '5 days'),
('55555555-5555-5555-5555-555555555555', 'New prospect inquiry - wholesale partnership. 15 retail locations. Assign to business development team for initial call.', 'staff', 'Admin', null, true, NOW() - INTERVAL '5 days' + INTERVAL '1 hour'); EXCEPTION WHEN foreign_key_violation OR unique_violation THEN NULL; END $seed$;

-- Conversation 6: GOT Gummies - Rush Order
DO $seed$ BEGIN INSERT INTO inquiry_messages (inquiry_id, message, sender_type, sender_name, sender_email, is_internal_note, created_at) VALUES
('66666666-6666-6666-6666-666666666666', 'URGENT: We have an unexpected retail opportunity and need 5,000 units of our standard formula by Friday. I know this is short notice, but is there any way you can accommodate this rush order? Willing to pay expedite fees.', 'customer', 'Robert Thompson', 'robert@gotgummies.com', false, NOW() - INTERVAL '6 hours'),
('66666666-6666-6666-6666-666666666666', 'Hi Robert! I understand the urgency. Let me check our production schedule and available inventory. We may have some units in bright stock that can help. Checking with production team now - will have an answer within the hour.', 'staff', 'Production Manager', null, false, NOW() - INTERVAL '5 hours'),
('66666666-6666-6666-6666-666666666666', 'Good news! We have 3,000 units available in bright stock and can schedule an emergency production run for the remaining 2,000 units tomorrow. With expedited processing, we can have everything packaged and ready for pickup/shipping by Thursday evening. Rush fee would be $750. Does this work?', 'staff', 'Production Manager', null, false, NOW() - INTERVAL '4 hours'),
('66666666-6666-6666-6666-666666666666', 'Perfect! Approved for the rush fee. We''ll arrange pickup Thursday evening. You''re a lifesaver!', 'customer', 'Robert Thompson', 'robert@gotgummies.com', false, NOW() - INTERVAL '3 hours'); EXCEPTION WHEN foreign_key_violation OR unique_violation THEN NULL; END $seed$;