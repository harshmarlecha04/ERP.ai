
-- Restore quantities to each lot
UPDATE public.raw_material_lots SET quantity = quantity + 248 WHERE id = '1eba454a-ab11-4643-8079-a8f97431a83c';
UPDATE public.raw_material_lots SET quantity = quantity + 240 WHERE id = '493809f6-a6c5-497f-a64e-dbc341ec3fbb';
UPDATE public.raw_material_lots SET quantity = quantity + 176 WHERE id = 'db5e3f68-e6f6-43e4-91fa-7bd58df7c415';
UPDATE public.raw_material_lots SET quantity = quantity + 10 WHERE id = '7cf78e01-22f7-40bf-a8ee-55905b7492d0';
UPDATE public.raw_material_lots SET quantity = quantity + 0.52 WHERE id = '52bb8bc5-de03-4de0-bb37-7b74ef55295d';
UPDATE public.raw_material_lots SET quantity = quantity + 1.8 WHERE id = '369cb562-79ed-4365-a350-2f2d6a3850df';
UPDATE public.raw_material_lots SET quantity = quantity + 8.8 WHERE id = '99b1f1c6-f1da-4fa1-bfa9-abd6651df865';
UPDATE public.raw_material_lots SET quantity = quantity + 0.6 WHERE id = '40ebc16d-3442-4fa1-8bb2-cbe095b20cc5';
UPDATE public.raw_material_lots SET quantity = quantity + 1.6 WHERE id = '11146393-f5a6-4d38-930b-f614ab12ec96';
UPDATE public.raw_material_lots SET quantity = quantity + 0.4 WHERE id = '35bcb906-8e70-41a7-a547-a30a3e4b80f7';
UPDATE public.raw_material_lots SET quantity = quantity + 8.8 WHERE id = '644b9391-0ff2-484a-811d-3aa83604c511';
UPDATE public.raw_material_lots SET quantity = quantity + 1.72 WHERE id = '298819d2-fd82-4f74-a0dd-9babbf19dacd';
UPDATE public.raw_material_lots SET quantity = quantity + 1.72 WHERE id = '32a2f2e4-3202-4e49-9acc-2595626acfbc';

-- Remove the ingredient deduction records
DELETE FROM public.ingredient_deductions WHERE completed_batch_id = '6a24fecb-947f-4f0f-999d-13cac9034b6e';

-- Remove the completed batch deduction record
DELETE FROM public.completed_batch_deductions WHERE id = '6a24fecb-947f-4f0f-999d-13cac9034b6e';
