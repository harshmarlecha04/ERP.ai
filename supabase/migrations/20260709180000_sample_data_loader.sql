-- Reversible sample-data loader for demos / first-run "looks alive" experience.
CREATE TABLE IF NOT EXISTS public._erp_sample_data (
  id bigserial PRIMARY KEY, table_name text NOT NULL, row_id uuid NOT NULL, created_at timestamptz DEFAULT now()
);
ALTER TABLE public._erp_sample_data ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admins manage sample tracking" ON public._erp_sample_data;
CREATE POLICY "admins manage sample tracking" ON public._erp_sample_data
  FOR ALL TO authenticated USING (has_role(auth.uid(),'admin'::app_role)) WITH CHECK (has_role(auth.uid(),'admin'::app_role));

CREATE OR REPLACE FUNCTION public.clear_sample_data() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $fn$
DECLARE ordered text[] := ARRAY['packaging_completion_records','production_schedule_items','production_schedules','order_line_items','order_headers','tasks','inventory_thresholds','raw_material_lots','raw_materials','formulas','customers']; t text;
BEGIN
  IF NOT has_role(auth.uid(),'admin'::app_role) THEN RAISE EXCEPTION 'Only admins can clear sample data'; END IF;
  FOREACH t IN ARRAY ordered LOOP
    -- Suppress audit/side-effect triggers while removing sample rows so
    -- delete-audit triggers (which FK-reference the row being deleted) don't fail.
    EXECUTE format('ALTER TABLE public.%I DISABLE TRIGGER USER', t);
    EXECUTE format('DELETE FROM public.%I WHERE id IN (SELECT row_id FROM public._erp_sample_data WHERE table_name=%L)', t, t);
    EXECUTE format('ALTER TABLE public.%I ENABLE TRIGGER USER', t);
    DELETE FROM public._erp_sample_data WHERE table_name=t;
  END LOOP;
END; $fn$;

CREATE OR REPLACE FUNCTION public.load_sample_data() RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $fn$
DECLARE
  uid uuid := auth.uid(); fid uuid; cid uuid; oid uuid; sid uuid; rmid uuid;
  formula_ids uuid[] := '{}'; customer_ids uuid[] := '{}'; i int;
  names text[]; mats text[]; custs text[]; ind text;
BEGIN
  IF NOT has_role(uid,'admin'::app_role) THEN RAISE EXCEPTION 'Only admins can load sample data'; END IF;
  SELECT industry INTO ind FROM public.company_settings WHERE id = 1;
  ind := COALESCE(ind, 'general');
  IF ind = 'chemicals' THEN
    names := ARRAY['Industrial Solvent A','Epoxy Resin','Cleaning Concentrate','Adhesive Base','Coating Additive','Surfactant Blend','Catalyst X','Polymer Compound'];
    mats := ARRAY['Acetone','Bisphenol-A','Sodium Hydroxide','Ethylene Glycol','Silica','Titanium Dioxide','Sulfuric Acid','Ammonia','Toluene','Calcium Carbonate'];
    custs := ARRAY['Industrial Partners','ChemDist Co','Apex Coatings','Meridian Plastics','Delta Solvents'];
  ELSIF ind = 'cosmetics' THEN
    names := ARRAY['Hydrating Serum','Vitamin C Cream','Sunscreen SPF30','Lip Balm','Body Lotion','Face Cleanser','Anti-Age Moisturizer','Hair Conditioner'];
    mats := ARRAY['Hyaluronic Acid','Glycerin','Shea Butter','Tocopherol','Zinc Oxide','Aloe Extract','Coconut Oil','Fragrance','Beeswax','Cetyl Alcohol'];
    custs := ARRAY['Glow Beauty','PureSkin Labs','Radiance Co','Bloom Cosmetics','Luxe Care'];
  ELSIF ind = 'food_beverage' THEN
    names := ARRAY['Protein Bar','Cold Brew Concentrate','Fruit Snack','Energy Drink','Granola Mix','Sauce Base','Seasoning Blend','Sparkling Water'];
    mats := ARRAY['Cane Sugar','Whey Protein','Cocoa Powder','Natural Flavor','Citric Acid','Sea Salt','Vegetable Oil','Oats','Fruit Puree','Baking Soda'];
    custs := ARRAY['FreshFoods Co','Grocery Direct','Vitality Beverages','Harvest Brands','Snack Nation'];
  ELSIF ind = 'pharmaceuticals' THEN
    names := ARRAY['Pain Relief Tablet','Antihistamine Cap','Antibiotic Suspension','Vitamin D Softgel','Cough Syrup','Antacid Chew','Sleep Aid Tablet','Immune Booster'];
    mats := ARRAY['Acetaminophen','Microcrystalline Cellulose','Magnesium Stearate','Lactose','Povidone','Croscarmellose','Titanium Dioxide','Gelatin','Sucrose','Purified Water'];
    custs := ARRAY['MedSupply Inc','PharmaDist','CareChain Pharmacy','Wellness Rx','Health Partners'];
  ELSIF ind = 'general' THEN
    names := ARRAY['Product A','Product B','Assembly Kit','Component Set','Finished Unit X','Module Y','Sub-Assembly Z','Widget Pro'];
    mats := ARRAY['Steel Sheet','Aluminum Rod','Plastic Pellets','Fasteners','Wiring Harness','Rubber Gasket','Paint','Adhesive','Circuit Board','Packaging Film'];
    custs := ARRAY['Global Distributors','Prime Industrial','Summit Wholesale','Metro Supply','Vertex Trading'];
  ELSE  -- nutraceuticals / default
    names := ARRAY['Vitamin C Gummy','Elderberry Immune','Multivitamin Kids','Melatonin Sleep','Biotin Beauty','Ashwagandha Calm','Omega-3 Chew','Probiotic Daily'];
    mats := ARRAY['Ascorbic Acid','Elderberry Extract','Pectin','Cane Sugar','Citric Acid','Melatonin','Biotin USP','Natural Flavor','Titanium Dioxide','Gelatin'];
    custs := ARRAY['Wellness Co','NutriBrand','VitaLabs','PureLife Supplements','Summit Nutrition'];
  END IF;
  PERFORM public.clear_sample_data();
  FOR i IN 1..array_length(names,1) LOOP
    INSERT INTO public.formulas (code,name,gummies_per_batch,default_batch_size_kg,status)
    VALUES ('F-'||lpad(i::text,3,'0'),names[i],100000,250,'active') RETURNING id INTO fid;
    formula_ids := formula_ids || fid; INSERT INTO public._erp_sample_data(table_name,row_id) VALUES ('formulas',fid);
  END LOOP;
  FOR i IN 1..array_length(mats,1) LOOP
    INSERT INTO public.raw_materials (code,name,supplier,uom)
    VALUES ('RM-'||lpad(i::text,3,'0'),mats[i],(ARRAY['Ingredients Inc','Global Supply','NatSource','ChemCo'])[1+(i%4)],'kg') RETURNING id INTO rmid;
    INSERT INTO public._erp_sample_data(table_name,row_id) VALUES ('raw_materials',rmid);
    INSERT INTO public.raw_material_lots (raw_material_id,lot_number,quantity,cost,expires_on,receiving_date)
    VALUES (rmid,'LOT-'||(1000+i),CASE WHEN i<=4 THEN 8 ELSE 120+(i*15) END,4.50+(i*0.4),current_date+(200+i*10),current_date-(i*7)) RETURNING id INTO fid;
    INSERT INTO public._erp_sample_data(table_name,row_id) VALUES ('raw_material_lots',fid);
    INSERT INTO public.inventory_thresholds (raw_material_id,min_quantity_kg,reorder_quantity_kg,alert_enabled,created_by)
    VALUES (rmid,25,100,true,uid) RETURNING id INTO fid;
    INSERT INTO public._erp_sample_data(table_name,row_id) VALUES ('inventory_thresholds',fid);
  END LOOP;
  FOR i IN 1..array_length(custs,1) LOOP
    INSERT INTO public.customers (company_name,company_code,contact_person,email,phone)
    VALUES (custs[i],'C-'||lpad(i::text,3,'0'),(ARRAY['Sarah Kim','James Lee','Maria Gomez','Tom Ford','Ava Chen'])[i],
            lower(replace(custs[i],' ',''))||'@example.com','(555) 01'||i||'-20'||i||i) RETURNING id INTO cid;
    customer_ids := customer_ids || cid; INSERT INTO public._erp_sample_data(table_name,row_id) VALUES ('customers',cid);
  END LOOP;
  FOR i IN 1..12 LOOP
    INSERT INTO public.order_headers (order_number,customer_id,due_date,status,priority,header_status,fulfillment_status,po_number,total_bottles_ordered,created_by,created_at)
    VALUES ('ORD-'||(1030+i),customer_ids[1+(i%array_length(customer_ids,1))],current_date+(i*3),(ARRAY['pending','scheduled','in_production','completed','shipped','packaging'])[1+(i%6)],
            (ARRAY['normal','high','urgent'])[1+(i%3)],(ARRAY['pending','approved','in_production','shipped','approved','in_production'])[1+(i%6)],
            (ARRAY['unfulfilled','in_progress','shipped'])[1+(i%3)],'PO-'||(9000+i),1000+(i*250),uid,now()-(i||' days')::interval) RETURNING id INTO oid;
    INSERT INTO public._erp_sample_data(table_name,row_id) VALUES ('order_headers',oid);
    INSERT INTO public.order_line_items (order_id,line_number,formula_id,bottle_size,bottles_ordered,product_name,price_per_unit,production_status)
    VALUES (oid,'1',formula_ids[1+(i%array_length(formula_ids,1))],(ARRAY[60,90,120])[1+(i%3)],1000+(i*250),
            names[1+(i%array_length(names,1))],8.50+(i*0.25),
            (ARRAY['pending','scheduled','in_progress','completed'])[1+(i%4)]) RETURNING id INTO fid;
    INSERT INTO public._erp_sample_data(table_name,row_id) VALUES ('order_line_items',fid);
  END LOOP;
  INSERT INTO public.production_schedules (schedule_date,status,created_by) VALUES (current_date,'in_progress',uid) RETURNING id INTO sid;
  INSERT INTO public._erp_sample_data(table_name,row_id) VALUES ('production_schedules',sid);
  FOR i IN 1..7 LOOP
    INSERT INTO public.production_schedule_items (schedule_id,formula_id,formula_code,batches,total_required_kg,materials_ok,current_stage,display_order)
    VALUES (sid,formula_ids[1+(i%array_length(formula_ids,1))],'F-'||lpad((1+(i%8))::text,3,'0'),1+(i%3),250*(1+(i%3)),(i%4)<>0,
            (ARRAY['mixing','deposit','drying','packaging','mixing','deposit','drying'])[i],i) RETURNING id INTO fid;
    INSERT INTO public._erp_sample_data(table_name,row_id) VALUES ('production_schedule_items',fid);
  END LOOP;
  FOR i IN 1..8 LOOP
    INSERT INTO public.tasks (title,description,status,priority,created_by,assignee_id,due_at)
    VALUES ((ARRAY['Review PO #1042','Order Vitamin C','QA batch B-88','Schedule Elderberry run','Update customer VitaLabs','Check pectin stock','Approve formula F-006','Ship order ORD-1035'])[i],
            'Auto-generated sample task',(ARRAY['open','in_progress','open','done','open','in_progress','open','open'])[i]::task_status,
            (ARRAY['high','normal','urgent','low','normal','high','normal','urgent'])[i]::task_priority,uid,uid,now()+((i)||' days')::interval) RETURNING id INTO fid;
    INSERT INTO public._erp_sample_data(table_name,row_id) VALUES ('tasks',fid);
  END LOOP;
  RETURN 'Sample data loaded';
END; $fn$;
GRANT EXECUTE ON FUNCTION public.load_sample_data() TO authenticated;
GRANT EXECUTE ON FUNCTION public.clear_sample_data() TO authenticated;
