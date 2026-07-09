-- Make order-pdfs bucket public for PDF viewing
UPDATE storage.buckets 
SET public = true 
WHERE id = 'order-pdfs';