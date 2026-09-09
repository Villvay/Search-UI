# Analytics batch execution summary

Generated: 2026-09-03T07:00:13.076Z

## Dataset

- File: `src/test-data/analytics/queries-top50-sku-nonsku-2026-08-31.json`
- Dataset key: `top50-sku-nonsku`
- Total queries (source): 200
- Unique queries (exact): 136
- Unique queries (case-insensitive): 131
- Exact duplicate occurrences: 64
- Categories: non-sku, sku
- Lists: non-sku-by-searches, non-sku-by-clicks, sku-by-searches, sku-by-clicks
- Queries executed per viewport (this run): 200
- Result rows (queries × modules × viewports): 600
- Workers: 1
- Modules: `on-type,suggestions,on-enter`
- Wall clock: 76m 9s
- Unique normalized queries: 131
- Duplicate rows: 69
- Actual executions: 393
- Deduplicated executions: 207

## Execution matrix

| Browser | Viewport | Queries | Passed | Failed | Skipped | Duration |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| Chromium | desktop-1440 | 200 | 297 | 96 | 207 | 76m 6s |

## Lifecycle metrics

| Browser | Viewport | Browser Launches | Context Launches | Page Launches | Recovers |
| --- | --- | ---: | ---: | ---: | ---: |
| Chromium | desktop-1440 | 1 | 1 | 1 | 0 |

## Lifecycle metrics (aggregated)

| Metric | Count |
| --- | ---: |
| Browser launches | 1 |
| Context launches | 1 |
| Page launches | 1 |
| Page recovers | 0 |
| Page recoveries | 0 |
| Soft failures | 96 |
| Hard failures | 0 |
| Home navigations | 3 |
| Reload recoveries | 0 |
| Passed | 297 |
| Failed | 96 |
| Skipped (deduped) | 207 |

## Failures

| Query ID | Query | Browser | Viewport | Module | Error |
| --- | --- | --- | --- | --- | --- |
| AN-NSF016 | lemans | Chromium | desktop-1440 | suggestions | Expected suggestions for AN-NSF016; empty=true count=0 |
| AN-NSF029 | movento | Chromium | desktop-1440 | suggestions | Expected suggestions for AN-NSF029; empty=true count=0 |
| AN-SKF015 | fenix j0793 | Chromium | desktop-1440 | suggestions | Expected suggestions for AN-SKF015; empty=true count=0 |
| AN-SKF021 | 569F4570B | Chromium | desktop-1440 | suggestions | Expected suggestions for AN-SKF021; empty=true count=0 |
| AN-SKF026 | dhp140-bsn-96 | Chromium | desktop-1440 | suggestions | Expected suggestions for AN-SKF026; empty=true count=0 |
| AN-NSF001 | closet rod | Chromium | desktop-1440 | on-enter | SERP product #1 title must include query "closet rod". Got: "Oval Chrome Tubing, 1-1/8" x 5/8" Steel - Pro Value Series 01.01.002 CHROME" |
| AN-NSF002 | Rev-A-Shelf Corporation | Chromium | desktop-1440 | on-enter | SERP product #1 title must include query "Rev-A-Shelf Corporation". Got: "Rev-A-Shelf 4WCSC 15" Maple Bottom Mount Waste Pullout with 2-35 Quart Silver metallic |
| AN-NSF004 | plywood | Chromium | desktop-1440 | on-enter | SERP product #3 title must include query "plywood". Got: "RP MAPLE, 3/4X4X8, VC, PF2S, Columbia Forest Products CARPWM75048VCPF2S" |
| AN-NSF007 | blum hinges | Chromium | desktop-1440 | on-enter | SERP product #1 title must include query "blum hinges". Got: "Blum CLIP top 110° Full Overlay Hinge Soft-Closing Screw-On Nickel-Plated 71B3550" |
| AN-NSF009 | screws | Chromium | desktop-1440 | on-enter | SERP product #1 title must include query "screws". Got: "Blum #6 x 5/8" Flat Head Wood Screw Phillips Drive - Sharp Point Coarse Thread Nickel, 28004573 - 100/B |
| AN-NSF011 | trash pullout | Chromium | desktop-1440 | on-enter | SERP product #1 title must include query "trash pullout". Got: "Pro Value Series WWB Maple Bottom Mount Waste Pullout with 2-35 Quart White Bins Soft-Close, SZW |
| AN-NSF014 | bar pull | Chromium | desktop-1440 | on-enter | SERP product #6 title must include query "bar pull". Got: "Pro Value Preferred 3-3/4" (96 mm) Center to Center Satin Nickel Pull, SZPF5-SN" |
| AN-NSF015 | shelf pins | Chromium | desktop-1440 | on-enter | SERP product #5 title must include query "shelf pins". Got: "5mm Locking Shelf Support Double Pin, Clear" |
| AN-NSF019 | olympus lock 1-3/4" Cam #326 | Chromium | desktop-1440 | on-enter | SERP product #1 title must include query "olympus lock 1-3/4" Cam #326". Got: "Olympus Lock, Inc Combi-Cam Ultra 1/4" Set Back - 7850-DC" |
| AN-NSF020 | hinges | Chromium | desktop-1440 | on-enter | SERP product #1 title must include query "hinges". Got: "Blum CLIP top 110° Full Overlay Hinge Soft-Closing Screw-On Nickel-Plated 71B3550" |
| AN-NSF021 | tafisa | Chromium | desktop-1440 | on-enter | SERP product #3 title must include query "tafisa". Got: "Particle Board Panels Standard 3/4 Thickness 49 x 97" |
| AN-NSF023 | grommet | Chromium | desktop-1440 | on-enter | SERP product #8 title must include query "grommet". Got: "Single Electric Trim Ring, White, 10/Pack" |
| AN-NSF024 | Kessebohmer USA Inc | Chromium | desktop-1440 | on-enter | SERP product #1 title must include query "Kessebohmer USA Inc". Got: "Kessebohmer 36 quart Champagne Trash Can, 14"W x 18"H x 10-1/2"D - 2503940103" |
| AN-NSF028 | pocket door | Chromium | desktop-1440 | on-enter | SERP product #4 title must include query "pocket door". Got: "8070 EZ Pivot Door Slide with Hinge and Baseplate, 30lb Capacity, Ebony Black, 18", Polybag" |
| AN-NSF030 | karran | Chromium | desktop-1440 | on-enter | SERP product #4 title must include query "karran". Got: "3-1/2" Quartz Strainer Basket, Black" |
| AN-NSF031 | drawer slides | Chromium | desktop-1440 | on-enter | SERP product #1 title must include query "drawer slides". Got: "Blum 563H Tandem Plus Blumotion 21" Soft-Close Full Extension 90 lb Undermount Drawer Slide, Zin |
| AN-NSF032 | mixer lift | Chromium | desktop-1440 | on-enter | SERP product #1 title must include query "mixer lift". Got: "Rev-A-Shelf ML-HD Silver 12" Appliance Lift, RAS-ML-HDSC" |
| AN-NSF033 | trash | Chromium | desktop-1440 | on-enter | SERP product #2 title must include query "trash". Got: "Pro Value Series WWB Maple Bottom Mount Waste Pullout with 2-50 Quart White Bins Soft-Close, SZWWB250WH" |
| AN-NSF036 | pulls | Chromium | desktop-1440 | on-enter | SERP product #1 title must include query "pulls". Got: "Amerock Blackrock 5-1/16" (128 mm) Center to Center Black Bronze Pull, BP55277BBR" |
| AN-NSF037 | contact adhesive | Chromium | desktop-1440 | on-enter | SERP product #7 title must include query "contact adhesive". Got: "HYBOND 12 5GAL FLAM ADHESIVE CLEAR, Choice Brands Adhesives AFFHY12-5GP-CL" |
| AN-NSF043 | trash pull out | Chromium | desktop-1440 | on-enter | SERP product #1 title must include query "trash pull out". Got: "Pro Value Series WWB Maple Bottom Mount Waste Pullout with 2-50 Quart White Bins Soft-Close, SZ |
| AN-NSF044 | shelf bracket | Chromium | desktop-1440 | on-enter | SERP product #2 title must include query "shelf bracket". Got: "400mm Adjustable Folding L-Bracket, Zinc Finish" |
| AN-NSF047 | rakks | Chromium | desktop-1440 | on-enter | SERP product #9 title must include query "rakks". Got: "EH Series 18" Vanity Support Bracket, Mill Finish" |
| AN-NSC011 | z clip | Chromium | desktop-1440 | on-enter | SERP product #1 title must include query "z clip". Got: "Z-Clips, Self-Mating EA5337 Series Extruded Aluminum Long Wall Clip 1-7/8"W x 72"L" |
| AN-NSC024 | cam locks | Chromium | desktop-1440 | on-enter | SERP product #1 title must include query "cam locks". Got: "CompX National Disc Tumbler Cam Lock, Bright Nickel with 1-3/16" Cylinder, C8053-C415A-14A" |
| AN-NSC026 | concealed bracket | Chromium | desktop-1440 | on-enter | SERP product #8 title must include query "concealed bracket". Got: "21" x 21" Heavy Duty Workstation Bracket, Black Finish (3 Pair)" |
| AN-NSC029 | bumpers | Chromium | desktop-1440 | on-enter | SERP product #1 title must include query "bumpers". Got: "Door Bumper Pad, Round, 7/16 dia. x 1/8 H, Clear, 500/Box" |
| AN-NSC035 | lamello | Chromium | desktop-1440 | on-enter | SERP product #1 title must include query "lamello". Got: "Tenso P-14 66mm x 28mm x 9.7mm Snapping Connector for All Angles, Box of 300" |
| AN-NSC041 | countertop support | Chromium | desktop-1440 | on-enter | SERP product #3 title must include query "countertop support". Got: "10" x 10" Freedom Hidden Countertop Bracket, Flat White Finish" |
| AN-NSC046 | mixing cups | Chromium | desktop-1440 | on-enter | SERP product #1 title must include query "mixing cups". Got: "PROFLOW Paint Mixing Cup, 1 Quart, 25 per sleeve / 200 per case" |
| AN-NSC049 | fastcap | Chromium | desktop-1440 | on-enter | SERP product #2 title must include query "fastcap". Got: "2P-10 Activator, 12 oz Refill" |
| AN-NSC050 | trash can | Chromium | desktop-1440 | on-enter | SERP product #8 title must include query "trash can". Got: "Rev-a-Shelf Trash Pull-Out Replacement Bin, 35Qt. Black Finish - RV-35-18-96" |
| AN-SKF002 | BP563H5330B | Chromium | desktop-1440 | on-enter | SERP product #1 title must include query "BP563H5330B". Got: "Würth Ruby 80 Grit 3" x 21" Portable Sanding Belt Aluminum Oxide on X-Weight Cloth" |
| AN-SKF004 | 909 | Chromium | desktop-1440 | on-enter | SERP product #3 title must include query "909". Got: "9 oz Adhesive Cartridge Mix Tip" |
| AN-SKF005 | 563h | Chromium | desktop-1440 | on-enter | SERP product #7 title must include query "563h". Got: "Blum 563F Tandem Plus Blumotion 21" Soft-Close Full Extension 90 lb Undermount Drawer Slide, Zinc, 262751 |
| AN-SKF006 | BP71B3580 | Chromium | desktop-1440 | on-enter | SERP product #1 title must include query "BP71B3580". Got: "Würth Ruby 80 Grit 3" x 21" Portable Sanding Belt Aluminum Oxide on X-Weight Cloth" |
| AN-SKF007 | dhp140bsn-96 | Chromium | desktop-1440 | on-enter | SERP product #1 title must include query "dhp140bsn-96". Got: "Würth Ruby 80 Grit 3" x 21" Portable Sanding Belt Aluminum Oxide on X-Weight Cloth" |
| AN-SKF008 | 909-58 | Chromium | desktop-1440 | on-enter | SERP product #3 title must include query "909-58". Got: "ColorCore2 High Pressure Laminate (HPL) 909 Black Matte 2 X 3" |
| AN-SKF010 | 71b3580 | Chromium | desktop-1440 | on-enter | SERP product #1 title must include query "71b3580". Got: "Würth Ruby 80 Grit 3" x 21" Portable Sanding Belt Aluminum Oxide on X-Weight Cloth" |
| AN-SKF011 | 949 | Chromium | desktop-1440 | on-enter | SERP product #1 title must include query "949". Got: "SeamFil Laminate Repair Filler - Formica Matches White, 1 oz" |
| AN-SKF013 | 563H5330B | Chromium | desktop-1440 | on-enter | SERP product #1 title must include query "563H5330B". Got: "Würth Ruby 80 Grit 3" x 21" Portable Sanding Belt Aluminum Oxide on X-Weight Cloth" |
| AN-SKF014 | 949-58 | Chromium | desktop-1440 | on-enter | SERP product #3 title must include query "949-58". Got: "Wolf Cabinets 047 SB33FH-WAVERLY HAZELNUT, 3949581" |
| AN-SKF015 | fenix j0793 | Chromium | desktop-1440 | on-enter | SERP product #1 title must include query "fenix j0793". Got: "Formica J0794-FN Verde Kitami Laminate 48" x 96", Matte Finish" |
| AN-SKF016 | dspro100 | Chromium | desktop-1440 | on-enter | SERP product #1 title must include query "dspro100". Got: "Pro Value Series 22" Full Extension Soft-Close Ball Bearing Drawer Slides PRO 100, Unhanded Side Moun |
| AN-SKF017 | d-dur 2k poly clear | Chromium | desktop-1440 | on-enter | SERP product #1 title must include query "d-dur 2k poly clear". Got: "D-Dur Polyurethane Clear Topcoat, Matte, 1 Gallon" |
| AN-SKF018 | 909 Surfaces | Chromium | desktop-1440 | on-enter | SERP product #3 title must include query "909 Surfaces". Got: "9 oz Adhesive Cartridge Mix Tip" |
| AN-SKF019 | DHP822MB | Chromium | desktop-1440 | on-enter | SERP product #1 title must include query "DHP822MB". Got: "Studio 917 Skyline 5-1/16" (128 mm) Center to Center Matte Black Pull, P822MB-128" |
| AN-SKF020 | IF711NP | Chromium | desktop-1440 | on-enter | SERP product #1 title must include query "IF711NP". Got: "Spoon Shaped Shelf Supports 5 mm Bore - Pro Value Series BA1306BN" |
| AN-SKF021 | 569F4570B | Chromium | desktop-1440 | on-enter | SERP product #1 title must include query "569F4570B". Got: "Fuller Collection Appliance Pull 18 Inch Center to Center Chrome - B077278-CH" |
| AN-SKF022 | e350 | Chromium | desktop-1440 | on-enter | SERP product #1 title must include query "e350". Got: "Würth Ruby 80 Grit 3" x 21" Portable Sanding Belt Aluminum Oxide on X-Weight Cloth" |
| AN-SKF023 | kv187 | Chromium | desktop-1440 | on-enter | [2mexpect([22m[31mlocator[39m[2m).[22mtoBeVisible[2m([22m[2m)[22m failed |
| AN-SKF025 | 53702 | Chromium | desktop-1440 | on-enter | SERP product #7 title must include query "53702". Got: "ProMatch Glaze All Purpose - Chemcraft 5932603" |
| AN-SKF026 | dhp140-bsn-96 | Chromium | desktop-1440 | on-enter | SERP product #1 title must include query "dhp140-bsn-96". Got: "Würth Ruby 80 Grit 3" x 21" Portable Sanding Belt Aluminum Oxide on X-Weight Cloth" |
| AN-SKF027 | formica 200 | Chromium | desktop-1440 | on-enter | SERP product #1 title must include query "formica 200". Got: "Formica backer sheet brown 48 x 96, 5/16 in" |
| AN-SKF030 | DHP822BSN | Chromium | desktop-1440 | on-enter | SERP product #1 title must include query "DHP822BSN". Got: "Studio 917 Skyline 5-1/16" (128 mm) Center to Center Brushed Satin Nickel Pull, P822BSN-128" |
| AN-SKF031 | BP563H4570B | Chromium | desktop-1440 | on-enter | SERP product #1 title must include query "BP563H4570B". Got: "Würth Ruby 80 Grit 3" x 21" Portable Sanding Belt Aluminum Oxide on X-Weight Cloth" |
| AN-SKF032 | 4WCSC-1835DM-2 | Chromium | desktop-1440 | on-enter | SERP product #1 title must include query "4WCSC-1835DM-2". Got: "Würth Ruby 80 Grit 3" x 21" Portable Sanding Belt Aluminum Oxide on X-Weight Cloth" |
| AN-SKF033 | BP173H7100 | Chromium | desktop-1440 | on-enter | SERP product #1 title must include query "BP173H7100". Got: "Würth Ruby 80 Grit 3" x 21" Portable Sanding Belt Aluminum Oxide on X-Weight Cloth" |
| AN-SKF034 | UF53111-46-003 | Chromium | desktop-1440 | on-enter | SERP product #1 title must include query "UF53111-46-003". Got: "Würth Ruby 80 Grit 3" x 21" Portable Sanding Belt Aluminum Oxide on X-Weight Cloth" |
| AN-SKF035 | BPT511901L | Chromium | desktop-1440 | on-enter | SERP product #1 title must include query "BPT511901L". Got: "Würth Ruby 80 Grit 3" x 21" Portable Sanding Belt Aluminum Oxide on X-Weight Cloth" |
| AN-SKF036 | WW48700 | Chromium | desktop-1440 | on-enter | SERP product #1 title must include query "WW48700". Got: "Würth Ruby 80 Grit 3" x 21" Portable Sanding Belt Aluminum Oxide on X-Weight Cloth" |
| AN-SKF037 | 71B3590 | Chromium | desktop-1440 | on-enter | SERP product #1 title must include query "71B3590". Got: "Würth Ruby 80 Grit 3" x 21" Portable Sanding Belt Aluminum Oxide on X-Weight Cloth" |
| AN-SKF038 | kv185 | Chromium | desktop-1440 | on-enter | [2mexpect([22m[31mlocator[39m[2m).[22mtoBeVisible[2m([22m[2m)[22m failed |
| AN-SKF040 | DSPRO100SC-20 | Chromium | desktop-1440 | on-enter | SERP product #1 title must include query "DSPRO100SC-20". Got: "Würth Ruby 80 Grit 3" x 21" Portable Sanding Belt Aluminum Oxide on X-Weight Cloth" |
| AN-SKF042 | SZPF1 | Chromium | desktop-1440 | on-enter | SERP product #4 title must include query "SZPF1". Got: "Würth Ruby 80 Grit 3" x 21" Portable Sanding Belt Aluminum Oxide on X-Weight Cloth" |
| AN-SKF044 | BP71B3550 | Chromium | desktop-1440 | on-enter | SERP product #1 title must include query "BP71B3550". Got: "Würth Ruby 80 Grit 3" x 21" Portable Sanding Belt Aluminum Oxide on X-Weight Cloth" |
| AN-SKF045 | RS4WCSC-1835DM-2 | Chromium | desktop-1440 | on-enter | SERP product #1 title must include query "RS4WCSC-1835DM-2". Got: "Würth Ruby 80 Grit 3" x 21" Portable Sanding Belt Aluminum Oxide on X-Weight Cloth" |
| AN-SKF046 | 8092 | Chromium | desktop-1440 | on-enter | [2mexpect([22m[31mlocator[39m[2m).[22mtoBeVisible[2m([22m[2m)[22m failed |
| AN-SKF047 | BP174H7100E | Chromium | desktop-1440 | on-enter | SERP product #1 title must include query "BP174H7100E". Got: "Würth Ruby 80 Grit 3" x 21" Portable Sanding Belt Aluminum Oxide on X-Weight Cloth" |
| AN-SKF048 | dspro3.0 | Chromium | desktop-1440 | on-enter | SERP product #1 title must include query "dspro3.0". Got: "Pro Value Series 20" Full Extension Standard Ball Bearing Drawer Slides PRO 3.0, Unhanded Side Mount  |
| AN-SKF049 | Formica 1994 | Chromium | desktop-1440 | on-enter | SERP product #3 title must include query "Formica 1994". Got: "Würth Ruby 80 Grit 3" x 21" Portable Sanding Belt Aluminum Oxide on X-Weight Cloth" |
| AN-SKC016 | kv85 | Chromium | desktop-1440 | on-enter | SERP product #6 title must include query "kv85". Got: "Heavy Duty Shelf Standards Double Slotted - Knape And Vogt 85 WH 36" |
| AN-SKC017 | 5 knuckle hinge | Chromium | desktop-1440 | on-enter | SERP product #1 title must include query "5 knuckle hinge". Got: "Pro Value Series Free Swinging Overlay Institutional Hinge, Screw-on Dull Chrome - PROIH76-26D |
| AN-SKC018 | 448UT-BCSC-8C | Chromium | desktop-1440 | on-enter | SERP product #1 title must include query "448UT-BCSC-8C". Got: "Würth Ruby 80 Grit 3" x 21" Portable Sanding Belt Aluminum Oxide on X-Weight Cloth" |
| AN-SKC021 | 174H7100E | Chromium | desktop-1440 | on-enter | SERP product #1 title must include query "174H7100E". Got: "Würth Ruby 80 Grit 3" x 21" Portable Sanding Belt Aluminum Oxide on X-Weight Cloth" |
| AN-SKC029 | kv 8091 | Chromium | desktop-1440 | on-enter | SERP product #1 title must include query "kv 8091". Got: "8091 Grass Full Overlay Hinge Kit for Pocket Door Slide with 75lb Capacity, Black" |
| AN-SKC031 | BP71B3590 | Chromium | desktop-1440 | on-enter | SERP product #1 title must include query "BP71B3590". Got: "Würth Ruby 80 Grit 3" x 21" Portable Sanding Belt Aluminum Oxide on X-Weight Cloth" |
| AN-SKC033 | 1/4 mdf | Chromium | desktop-1440 | on-enter | SERP product #2 title must include query "1/4 mdf". Got: "Medite Pembroke Premium MDF Board Panels Standard Core 3/4” Thickness, 4 x 8" |
| AN-SKC035 | 4SDI-36-1 | Chromium | desktop-1440 | on-enter | SERP product #1 title must include query "4SDI-36-1". Got: "Würth Ruby 80 Grit 3" x 21" Portable Sanding Belt Aluminum Oxide on X-Weight Cloth" |
| AN-SKC036 | dspro100sc | Chromium | desktop-1440 | on-enter | SERP product #1 title must include query "dspro100sc". Got: "Pro Value Series 22" Full Extension Soft-Close Ball Bearing Drawer Slides PRO 100, Unhanded Side Mo |
| AN-SKC037 | 18 Inch depth soft close drawer glides | Chromium | desktop-1440 | on-enter | SERP product #1 title must include query "18 Inch depth soft close drawer glides". Got: "KV8450 18" Full Extension Soft-Close Ball Bearing Drawer Slides, Unhand |
| AN-SKC038 | 4WCT-3 | Chromium | desktop-1440 | on-enter | SERP product #1 title must include query "4WCT-3". Got: "Würth Ruby 80 Grit 3" x 21" Portable Sanding Belt Aluminum Oxide on X-Weight Cloth" |
| AN-SKC039 | 448-bcsc-8c | Chromium | desktop-1440 | on-enter | SERP product #1 title must include query "448-bcsc-8c". Got: "Würth Ruby 80 Grit 3" x 21" Portable Sanding Belt Aluminum Oxide on X-Weight Cloth" |
| AN-SKC040 | kv8091 | Chromium | desktop-1440 | on-enter | SERP product #1 title must include query "kv8091". Got: "8091 Grass Full Overlay Hinge Kit for Pocket Door Slide with 75lb Capacity, Black" |
| AN-SKC041 | 173H7100 | Chromium | desktop-1440 | on-enter | SERP product #1 title must include query "173H7100". Got: "Würth Ruby 80 Grit 3" x 21" Portable Sanding Belt Aluminum Oxide on X-Weight Cloth" |
| AN-SKC044 | kv8400 | Chromium | desktop-1440 | on-enter | [2mexpect([22m[31mlocator[39m[2m).[22mtoBeVisible[2m([22m[2m)[22m failed |
| AN-SKC046 | 5mm shelf pins | Chromium | desktop-1440 | on-enter | SERP product #1 title must include query "5mm shelf pins". Got: "5mm Locking Shelf Support Double Pin, Clear" |
| AN-SKC047 | 448-bcsc-5c | Chromium | desktop-1440 | on-enter | SERP product #1 title must include query "448-bcsc-5c". Got: "Würth Ruby 80 Grit 3" x 21" Portable Sanding Belt Aluminum Oxide on X-Weight Cloth" |
| AN-SKC048 | dspro600 | Chromium | desktop-1440 | on-enter | SERP product #1 title must include query "dspro600". Got: "Pro Value Series 21" Soft-Close Full Extension PRO600 Undermount Drawer Slides, Ball Bearing Zinc - 0 |
| AN-SKC049 | 71T5580 | Chromium | desktop-1440 | on-enter | SERP product #1 title must include query "71T5580". Got: "Würth Ruby 80 Grit 3" x 21" Portable Sanding Belt Aluminum Oxide on X-Weight Cloth" |
| AN-SKC050 | 71B3550 | Chromium | desktop-1440 | on-enter | SERP product #1 title must include query "71B3550". Got: "Würth Ruby 80 Grit 3" x 21" Portable Sanding Belt Aluminum Oxide on X-Weight Cloth" |

## Reliability

- Soft ON-ENTER failures reset the search input on the current page; home/reload only when the page is unusable.
- Normalized-query dedupe executes once per viewport/module; every original query ID is still reported.
- Functional ON-TYPE keystroke specs are unchanged; analytics uses `fill()`.
- Workers shard by browser/viewport project; queries within a viewport stay on one page.

## Recommendation

See `reports/analytics-batch-runtime-comparison.md` for measured worker guidance.

