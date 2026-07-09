-- Grant production_manager role to QA users so they can access formulas for quality control
INSERT INTO user_roles (user_id, role, granted_by)
VALUES 
  ('4673610c-ea43-4523-86ba-7e2b46b6dee2', 'production_manager', 'a8a2da39-c15e-4998-b13c-8e6258ea91ea'), -- Mahek (mfgqa@pharmvista.com)
  ('fc773505-26bf-41b9-b0d5-7b046cfbd938', 'production_manager', 'a8a2da39-c15e-4998-b13c-8e6258ea91ea'); -- Tejas Parikh (qa6@pharmvista.com)