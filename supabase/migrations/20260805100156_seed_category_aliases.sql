-- Milestone 7 Phase C. Every akahu_category_id below is a real, observed
-- value from the first real Akahu sync (ANZ, household
-- a96aae22-cbc0-47b2-ae5c-3c397790c5a3, 2026-08-05) — verified via
--   select distinct raw_payload -> 'category' ->> '_id',
--                    raw_payload -> 'category' ->> 'name'
--   from transactions where raw_payload -> 'category' is not null;
-- None of these are invented. 63 distinct real categories were observed;
-- all 63 are mapped here. Mapping a real, observed Akahu category to one
-- of the 7 fixed categories is inherently a judgment call in the same way
-- the 7 category names themselves were (still unconfirmed, per the
-- Milestone 7 design doc §1/§14) — see the implementation report for the
-- full per-category reasoning and the specific borderline calls, so any
-- of these can be corrected with a plain UPDATE, no redesign needed.
--
-- 1,060 of 2,266 real transactions (~47%) have no category key at all —
-- Akahu itself did not categorize them (largely transfers/P2P payments,
-- observed directly in the raw payload, not a mapping gap on our side).
-- Those transactions have no alias to match and correctly fall through to
-- Uncategorized via transaction_category_resolution's existing fallback -
-- nothing in this migration or design handles that case specially.
insert into public.category_aliases (akahu_category_id, category_id) values
  -- Groceries
  ('nzfcc_ckouvvy98001a08ml3l180boh', 'df9da201-ff3c-434c-ae5f-9953eb3e8787'), -- Bakeries
  ('nzfcc_ckouvvy84001608ml5p6z4d8j', 'df9da201-ff3c-434c-ae5f-9953eb3e8787'), -- Supermarkets and grocery stores
  ('nzfcc_ckpyo79om000009kw58cq8czp', 'df9da201-ff3c-434c-ae5f-9953eb3e8787'), -- Meal kit stores
  ('nzfcc_ckouvvyaa001b08ml4uj9b2qc', 'df9da201-ff3c-434c-ae5f-9953eb3e8787'), -- Convenience stores
  ('nzfcc_ckpyo8lga000109kw7pyhcdxw', 'df9da201-ff3c-434c-ae5f-9953eb3e8787'), -- Specialty food stores
  ('nzfcc_ckouvvy8m001708ml68px9wcf', 'df9da201-ff3c-434c-ae5f-9953eb3e8787'), -- Meat supplies
  ('nzfcc_clahchmg0000108mo8cnf2bs2', 'df9da201-ff3c-434c-ae5f-9953eb3e8787'), -- Fish and seafood supplies

  -- Dining & Takeaways
  ('nzfcc_ckouvvyw1004408mlhy158i7j', '9a04a7a4-17ee-4666-8e39-743a1c698206'), -- Cafes and restaurants
  ('nzfcc_ckouvvywi004508mlacrd41wf', '9a04a7a4-17ee-4666-8e39-743a1c698206'), -- Fast food stores
  ('nzfcc_ckouvvy8o001808ml9ld14mx1', '9a04a7a4-17ee-4666-8e39-743a1c698206'), -- Ice cream, gelato, nut, and confectionary stores

  -- Transport
  ('nzfcc_ckouvvytq003o08mlbcy57jft', '5b66076d-cc76-4404-848b-bf70490349dc'), -- Fuel stations
  ('nzfcc_ckouvvyxm004c08mlexbea79o', '5b66076d-cc76-4404-848b-bf70490349dc'), -- Taxi, rideshare, and on-demand transport services
  ('nzfcc_ckouvvyy8004h08ml568d813k', '5b66076d-cc76-4404-848b-bf70490349dc'), -- Transport services (not elsewhere classified)
  ('nzfcc_clahcegjo000008l250of62eq', '5b66076d-cc76-4404-848b-bf70490349dc'), -- Bus and shuttle transport services
  ('nzfcc_ckouvvyza004j08ml2jqr21bt', '5b66076d-cc76-4404-848b-bf70490349dc'), -- Parking services
  ('nzfcc_ckouvvy4q001008ml3dl13w1q', '5b66076d-cc76-4404-848b-bf70490349dc'), -- Automotive parts and accessories
  ('nzfcc_ckouvvyy7004g08mlc3hedgqz', '5b66076d-cc76-4404-848b-bf70490349dc'), -- Air transport services
  ('nzfcc_ckouvvytt003r08ml0nc1h7im', '5b66076d-cc76-4404-848b-bf70490349dc'), -- Automotive body repair and painting services
  ('nzfcc_ckouvvyx4004a08ml4rop060m', '5b66076d-cc76-4404-848b-bf70490349dc'), -- Boat transport services

  -- Utilities & Bills
  ('nzfcc_ckouvvz0y004t08ml8zey1jiv', '53959c71-25f3-4466-80ed-a130c6aa71ad'), -- Telecommunication services
  ('nzfcc_cl2pbn9e4000009mp382ddhbq', '53959c71-25f3-4466-80ed-a130c6aa71ad'), -- Local government
  ('nzfcc_ckq5t8pp9000009jvbego537k', '53959c71-25f3-4466-80ed-a130c6aa71ad'), -- Waste and recycling services

  -- Shopping
  ('nzfcc_ckouvvyge002108mlfe0l2thb', '7c38eaf4-c930-4552-8265-1290787c0ddb'), -- Electronic and appliance stores
  ('nzfcc_ckouvvypt003408mle59z71f4', '7c38eaf4-c930-4552-8265-1290787c0ddb'), -- Pets and related supplies, accommodation, and services
  ('nzfcc_ckouvvybd001f08ml8w4y3yor', '7c38eaf4-c930-4552-8265-1290787c0ddb'), -- General retail stores
  ('nzfcc_ckouvvxz6000m08ml620k803p', '7c38eaf4-c930-4552-8265-1290787c0ddb'), -- Building supplies
  ('nzfcc_ckouvvyio002f08ml0kh60x4i', '7c38eaf4-c930-4552-8265-1290787c0ddb'), -- Sports equipment and supplies
  ('nzfcc_ckouvvyac001c08mlbyp5doni', '7c38eaf4-c930-4552-8265-1290787c0ddb'), -- Liquor stores
  ('nzfcc_ckouvvydo001q08ml4xvgfhgl', '7c38eaf4-c930-4552-8265-1290787c0ddb'), -- Clothing stores
  ('nzfcc_ckouvvxz8000n08ml5gcoffpm', '7c38eaf4-c930-4552-8265-1290787c0ddb'), -- Hardware equipment and supplies
  ('nzfcc_ckouvvyi2002b08mlh2elakks', '7c38eaf4-c930-4552-8265-1290787c0ddb'), -- Stationery and office supplies
  ('nzfcc_ckouvvyo6002y08mlfafxgd3o', '7c38eaf4-c930-4552-8265-1290787c0ddb'), -- Gift and souvenir stores
  ('nzfcc_ckouvvycl001o08ml7wxo8w4j', '7c38eaf4-c930-4552-8265-1290787c0ddb'), -- Shoe stores
  ('nzfcc_ckouvvygg002308ml8p0z179o', '7c38eaf4-c930-4552-8265-1290787c0ddb'), -- Fabric, sewing, knitting, and related supplies
  ('nzfcc_ckouvvyqy003b08ml65aj5svx', '7c38eaf4-c930-4552-8265-1290787c0ddb'), -- Watch, clock, and jewellery stores and services
  ('nzfcc_ckouvvy0t000q08mlhm1r54o5', '7c38eaf4-c930-4552-8265-1290787c0ddb'), -- Painting supplies and services
  ('nzfcc_ckouvvybf001g08mlczajat62', '7c38eaf4-c930-4552-8265-1290787c0ddb'), -- Variety stores
  ('nzfcc_ckouvvyfc001z08ml7yeugcst', '7c38eaf4-c930-4552-8265-1290787c0ddb'), -- Home furnishing and repair stores
  ('nzfcc_ckouvvye7001s08mld9hj5q2y', '7c38eaf4-c930-4552-8265-1290787c0ddb'), -- Apparel and accessory stores
  ('nzfcc_ckphrdp9f000008ml5t9g7d0m', '7c38eaf4-c930-4552-8265-1290787c0ddb'), -- Wineries, breweries, and distilleries

  -- Entertainment
  ('nzfcc_ckouvvzhn006t08mlg81xhlbx', '6ebaba1f-d562-45c9-9df8-76d02c112382'), -- Media and entertainment streaming services
  ('nzfcc_ckouvvziq006z08mldbw7eyne', '6ebaba1f-d562-45c9-9df8-76d02c112382'), -- Sports and athletic clubs
  ('nzfcc_ckouvvzhm006s08ml5q7r9iof', '6ebaba1f-d562-45c9-9df8-76d02c112382'), -- Cinemas
  ('nzfcc_ckouvvzi5006v08mlg3pndlk0', '6ebaba1f-d562-45c9-9df8-76d02c112382'), -- Entertainment (not elsewhere classified)
  ('nzfcc_ckouvvyvh004108mlfau3hrm2', '6ebaba1f-d562-45c9-9df8-76d02c112382'), -- Bars, pubs, nightclubs
  ('nzfcc_ckouvvzjc007408mlh0ev5y3t', '6ebaba1f-d562-45c9-9df8-76d02c112382'), -- Performing art training
  ('nzfcc_ckouvvzi7006w08ml6blq7e83', '6ebaba1f-d562-45c9-9df8-76d02c112382'), -- Events and tickets (not elsewhere classified)
  ('nzfcc_ckouvvzju007608mldg1lf61f', '6ebaba1f-d562-45c9-9df8-76d02c112382'), -- Attractions, museums, zoos, amusement parks, circuses, exhibits
  ('nzfcc_ckouvvywj004608mlho382gvn', '6ebaba1f-d562-45c9-9df8-76d02c112382'), -- Gyms, fitness, aquatic facilities, yoga, pilates
  ('nzfcc_ckouvvyvg004008ml6zun9stl', '6ebaba1f-d562-45c9-9df8-76d02c112382'), -- Motor parks, campgrounds, holiday parks, recreational camps

  -- Other
  ('nzfcc_ckpymsz13000009l2alfj3mw4', '0fbb7368-6a26-465e-9aa0-498953dcfb59'), -- Business software and cloud services
  ('nzfcc_ckouvvzc2006208ml5mg1cxf7', '0fbb7368-6a26-465e-9aa0-498953dcfb59'), -- Financial asset brokers, exchanges, and managed funds
  ('nzfcc_ckouvvyn3002s08mle90qdtmo', '0fbb7368-6a26-465e-9aa0-498953dcfb59'), -- Pharmacies
  ('nzfcc_cl15vdeg8000009l32o2v1ory', '0fbb7368-6a26-465e-9aa0-498953dcfb59'), -- Lending services
  ('nzfcc_ckouvvzbk006008ml1ks82is1', '0fbb7368-6a26-465e-9aa0-498953dcfb59'), -- National government services
  ('nzfcc_ckouvvzn8007k08ml806zcml0', '0fbb7368-6a26-465e-9aa0-498953dcfb59'), -- Cosmetic, health spas, and relaxation massage services
  ('nzfcc_cl9rwlp2s000009l3gmy97xxj', '0fbb7368-6a26-465e-9aa0-498953dcfb59'), -- Medical services (not elsewhere classified)
  ('nzfcc_ckouvvz86005e08mlc63abinn', '0fbb7368-6a26-465e-9aa0-498953dcfb59'), -- Consumer electronics repair and services
  ('nzfcc_ckouvvyux003x08mlgwyo6uq6', '0fbb7368-6a26-465e-9aa0-498953dcfb59'), -- Hotels, motels, and other temporary accommodation
  ('nzfcc_ckouvvzfd006i08ml2xnjeo2m', '0fbb7368-6a26-465e-9aa0-498953dcfb59'), -- Chiropractors and osteopaths
  ('nzfcc_ckouvvzed006e08ml8jxcfkbq', '0fbb7368-6a26-465e-9aa0-498953dcfb59'), -- Doctors and physicians
  ('nzfcc_ckouvvzfg006k08ml56i13bn6', '0fbb7368-6a26-465e-9aa0-498953dcfb59'), -- Optometrists and eyewear
  ('nzfcc_ckouvvzm2007g08ml8m0q4ury', '0fbb7368-6a26-465e-9aa0-498953dcfb59'); -- Haircuts and treatments
