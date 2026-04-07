export type RuralServiceCategory =
  | 'Coordinated Entry'
  | 'Shelter'
  | 'Supportive Housing'
  | 'Legal'
  | 'Housing (Low-Income)'
  | 'Recovery/Boarding'
  | 'Food'
  | 'Family Services'
  | 'Senior Services'
  | 'Employment'
  | 'Disability Services'
  | 'Physical Health'
  | 'Substance Use'
  | 'Mental Health';

export const RURAL_SERVICE_CATEGORIES: RuralServiceCategory[] = [
  'Coordinated Entry', 'Shelter', 'Supportive Housing', 'Legal',
  'Housing (Low-Income)', 'Recovery/Boarding', 'Food', 'Family Services',
  'Senior Services', 'Employment', 'Disability Services', 'Physical Health',
  'Substance Use', 'Mental Health',
];

export interface RuralService {
  id: string;
  name: string;
  category: RuralServiceCategory;
  county: string;
  city: string;
  address?: string;
  phone?: string;
  website?: string;
  notes?: string;
  lat: number;
  lng: number;
}

export const ruralServices: RuralService[] = [
  // ── Carson City ──
  // 900 E Long St → 39.1546, -119.7534
  { id: "rs-1", name: "Carson City Health & Human Services", category: "Coordinated Entry", county: "Carson City", city: "Carson City", address: "900 East Long Street, Carson City, NV 89706", phone: "(775) 887-2110", lat: 39.17415, lng: -119.75815 },
  { id: "rs-2", name: "Advocates to End Domestic Violence", category: "Shelter", county: "Carson City", city: "Carson City", address: "3640 Gordon Street, Carson City, NV 89702", phone: "(775) 883-7654", lat: 39.17819, lng: -119.72636 },
  { id: "rs-3", name: "FISH - FOCUS House (Men's Shelter)", category: "Shelter", county: "Carson City", city: "Carson City", address: "138 E Long St, Carson City, NV 89706", phone: "(775) 882-3474", lat: 39.17417, lng: -119.76628, notes: "co-located with FISH Food Pantry" },
  { id: "rs-4", name: "FISH - Wylie House (Women & Family)", category: "Shelter", county: "Carson City", city: "Carson City", address: "408 Hot Springs Rd, Carson City, NV 89706", phone: "(775) 882-3474", lat: 39.1640, lng: -119.7700, notes: "street-level approx" },
  { id: "rs-5", name: "Carson City Health & Human Services (PSH/RRH)", category: "Supportive Housing", county: "Carson City", city: "Carson City", address: "900 E. Long Street, Carson City, NV 89706", phone: "(775) 887-2110", lat: 39.17291, lng: -119.75711 },
  { id: "rs-6", name: "Nation's Finest - SSVF Program", category: "Supportive Housing", county: "Carson City", city: "Carson City", address: "106 E. Adams Street, Suite 203, Carson City, NV 89706", phone: "(775) 360-2155", lat: 39.17349, lng: -119.76669 },
  { id: "rs-7", name: "Volunteer Attorneys for Rural Nevadans (VARN)", category: "Legal", county: "Carson City", city: "Carson City", address: "412 W. John Street, Suite C, Carson City, NV 89703", phone: "(775) 883-8278", lat: 39.17121, lng: -119.76964 },
  // 2621 Northgate Ln → 39.1887, -119.7558
  { id: "rs-8", name: "Carson & Rural Elder Law Program (CARE)", category: "Legal", county: "Carson City", city: "Carson City", address: "2621 Northgate Lane, Suite 6, Carson City, NV 89706", phone: "(775) 687-4680", lat: 39.18347, lng: -119.76589 },
  { id: "rs-9", name: "Nevada Legal Services", category: "Legal", county: "Carson City", city: "Carson City", address: "209 N. Pratt, Carson City, NV 89701", phone: "(775) 883-0404", lat: 39.1625, lng: -119.75997 },
  { id: "rs-10", name: "LYFE Recovery", category: "Recovery/Boarding", county: "Carson City", city: "Carson City", address: "1655 N Edmonds Drive, Carson City, NV 89701", phone: "(844) 463-9593", lat: 39.17624, lng: -119.72443 },
  { id: "rs-11", name: "Northern Nevada Dream Center", category: "Food", county: "Carson City", city: "Carson City", address: "3579 U.S 50 #211, Carson City, NV 89701", phone: "(775) 443-4090", lat: 39.13497, lng: -119.76939 },
  { id: "rs-12", name: "Calvary Chapel Carson City", category: "Food", county: "Carson City", city: "Carson City", address: "1635 East Clearview Drive, Carson City, NV 89701", phone: "(775) 883-5215", lat: 39.12847, lng: -119.74969 },
  { id: "rs-13", name: "FISH Food Pantry", category: "Food", county: "Carson City", city: "Carson City", address: "138 E Long Street, Carson City, NV 89706", phone: "(775) 882-3474", lat: 39.17417, lng: -119.76628 },
  { id: "rs-14", name: "Community Essential Emergency Food Bank", category: "Food", county: "Carson City", city: "Carson City", address: "2621 Northgate Lane, Suite 62, Carson City, NV 89706", phone: "(775) 884-2269", lat: 39.18347, lng: -119.76589 },
  { id: "rs-15", name: "Carson City WIC", category: "Food", county: "Carson City", city: "Carson City", address: "900 East Long Street, Carson City, NV 89706", phone: "(775) 887-2190", lat: 39.17415, lng: -119.75815 },
  { id: "rs-16", name: "Ron Wood Family Resource Center", category: "Family Services", county: "Carson City", city: "Carson City", address: "2621 Northgate Lane, Carson City, NV 89706", phone: "(775) 884-2269", lat: 39.18347, lng: -119.76589 },
  { id: "rs-17", name: "Department of Children and Family Services (DCFS)", category: "Family Services", county: "Carson City", city: "Carson City", address: "2533 N Carson Suite #100, Carson City, NV 89706", phone: "(775) 684-1930", lat: 39.19154, lng: -119.76868 },
  { id: "rs-18", name: "The Children's Cabinet", category: "Family Services", county: "Carson City", city: "Carson City", address: "2527 N Carson Suite #255, Carson City, NV 89706", phone: "(775) 856-6200", lat: 39.19133, lng: -119.76851 },
  { id: "rs-19", name: "Family Wellness Center, LLC", category: "Family Services", county: "Carson City", city: "Carson City", address: "123 W Nye Lane Suite 525, Carson City, NV 89706", phone: "(775) 400-2996", lat: 39.18642, lng: -119.76844 },
  { id: "rs-20", name: "Carson City Senior Center", category: "Senior Services", county: "Carson City", city: "Carson City", address: "911 Beverly Drive, Carson City, NV 89706", phone: "(775) 883-0703", lat: 39.17509, lng: -119.76078 },
  { id: "rs-21", name: "Aging and Disability Services Division", category: "Senior Services", county: "Carson City", city: "Carson City", address: "1550 E College Parkway, Carson City, NV 89706", phone: "(775) 687-4210", lat: 39.1901, lng: -119.75038 },
  { id: "rs-22", name: "Employ NV", category: "Employment", county: "Carson City", city: "Carson City", address: "1929 N. Carson Street, Carson City, NV 89701", phone: "(775) 684-0400", lat: 39.18244, lng: -119.76811 },
  { id: "rs-23", name: "NV Vocational Rehabilitation", category: "Employment", county: "Carson City", city: "Carson City", address: "1933 N. Carson Street, Carson City, NV 89701", phone: "(775) 684-0425", lat: 39.18274, lng: -119.76813 },
  { id: "rs-24", name: "Aging and Disability Services Division", category: "Disability Services", county: "Carson City", city: "Carson City", address: "1550 E College Parkway, Carson City, NV 89706", phone: "(775) 687-4210", lat: 39.1901, lng: -119.75038 },
  { id: "rs-25", name: "Cancer Resource Center", category: "Physical Health", county: "Carson City", city: "Carson City", address: "1535 Medical Parkway, Carson City, NV 89703", phone: "(775) 445-7500", lat: 39.19729, lng: -119.77784 },
  // 3325 Research Way → matches c7: 39.1880, -119.7530
  { id: "rs-26", name: "Sierra Nevada Health Center", category: "Physical Health", county: "Carson City", city: "Carson City", address: "3325 Research Way, Carson City, NV 89706", phone: "(775) 887-5140", lat: 39.18905, lng: -119.75041 },
  // 1802 N Carson St → matches c2/t11: 39.1757, -119.7670
  { id: "rs-27", name: "Battle Born Counseling Center", category: "Substance Use", county: "Carson City", city: "Carson City", address: "1802 N Carson Street, Suite 103, Carson City, NV 89701", phone: "(775) 350-4809", lat: 39.1757, lng: -119.7670 },
  { id: "rs-28", name: "Vitality Carson City (Residential)", category: "Substance Use", county: "Carson City", city: "Carson City", address: "900 E Long Street, Carson City, NV 89706", phone: "(775) 461-0999", lat: 39.17415, lng: -119.75815 },
  // 205 S Pratt Ave → near t3 (207 S Pratt): 39.1631, -119.7676
  { id: "rs-29", name: "Community Counseling Center", category: "Substance Use", county: "Carson City", city: "Carson City", address: "205 S Pratt Avenue, Carson City, NV 89701", phone: "(775) 882-3945", lat: 39.16307, lng: -119.75985 },
  { id: "rs-30", name: "The Life Change Center", category: "Substance Use", county: "Carson City", city: "Carson City", address: "1201 N Stewart Street, Carson City, NV 89701", phone: "(775) 350-7250", lat: 39.17121, lng: -119.76432 },
  { id: "rs-31", name: "DPBH-Rural Clinics: Carson City", category: "Mental Health", county: "Carson City", city: "Carson City", address: "1665 Old Hot Springs Road, Suite 150, Carson City, NV 89706", phone: "(775) 687-0870", lat: 39.19282, lng: -119.75351 },
  { id: "rs-32", name: "Connections Behavioral Health Center", category: "Mental Health", county: "Carson City", city: "Carson City", address: "77 E William Suite #106, Carson City, NV 89701", phone: "(775) 686-0117", lat: 39.1640, lng: -119.7685 },
  { id: "rs-33", name: "Serenity Mental Health", category: "Mental Health", county: "Carson City", city: "Carson City", address: "755 N Roop Suite #101, Carson City, NV 89701", phone: "(775) 841-6050", lat: 39.16631, lng: -119.76155 },

  // ── Churchill ──
  // 270 S Maine St → 39.4710, -118.7776
  { id: "rs-34", name: "Churchill County Social Services", category: "Coordinated Entry", county: "Churchill", city: "Fallon", address: "270 S. Maine Street, Suite B, Fallon, NV 89406", phone: "(775) 423-6695", lat: 39.4724, lng: -118.77729 },
  { id: "rs-35", name: "DVI Fallon", category: "Shelter", county: "Churchill", city: "Fallon", address: "37 S. Maine Street, Fallon, NV 89406", phone: "(775) 423-1313", lat: 39.47442, lng: -118.77692 },
  { id: "rs-36", name: "Churchill County Social Services - PATH", category: "Shelter", county: "Churchill", city: "Fallon", address: "270 S. Maine Street, Suite B, Fallon, NV 89406", phone: "(775) 423-6695", lat: 39.4724, lng: -118.77729 },
  { id: "rs-37", name: "Stepping Stones Youth Shelter (FPST)", category: "Shelter", county: "Churchill", city: "Fallon", address: "2101 Agency Road, Fallon, NV 89406", phone: "(775) 423-1132", lat: 39.46731, lng: -118.76104 },
  { id: "rs-38", name: "Churchill County Social Services (RRH)", category: "Supportive Housing", county: "Churchill", city: "Fallon", address: "270 S. Maine Street, Suite B, Fallon, NV 89406", phone: "(775) 423-6695", lat: 39.4724, lng: -118.77729 },
  { id: "rs-39", name: "New Frontier - Room for Ruth (Women)", category: "Recovery/Boarding", county: "Churchill", city: "Fallon", address: "1490 Grimes St, Fallon, NV 89406", phone: "(775) 423-1412", lat: 39.47173, lng: -118.7948, notes: "co-located with New Frontier Treatment Center" },
  // 96 N Broadway → 39.4760, -118.7780
  { id: "rs-40", name: "The Lighthouse at Fallon Christian Fellowship (Men)", category: "Recovery/Boarding", county: "Churchill", city: "Fallon", address: "96 N Broadway, Fallon, NV 89406", phone: "(775) 423-6360", lat: 39.47514, lng: -118.77708 },
  { id: "rs-41", name: "Fallon Daily Bread", category: "Food", county: "Churchill", city: "Fallon", address: "280 E Stillwater Street, Fallon, NV", phone: "(775) 423-4714", lat: 39.4755, lng: -118.7740 },
  // 1490 Grimes St → 39.4680, -118.7810
  { id: "rs-42", name: "New Frontier Food Pantry", category: "Food", county: "Churchill", city: "Fallon", address: "1490 Grimes Street, Fallon, NV 89406", phone: "(775) 442-1686", lat: 39.47173, lng: -118.7948 },
  { id: "rs-43", name: "REAP Soup Kitchen", category: "Food", county: "Churchill", city: "Fallon", address: "985 W. Williams Ave, Fallon, NV 89406", phone: "(775) 420-8304", lat: 39.4747, lng: -118.78776 },
  { id: "rs-44", name: "DCFS Churchill", category: "Family Services", county: "Churchill", city: "Fallon", address: "1735 Kaiser Street, Fallon, NV 89406", phone: "(775) 423-4800", lat: 39.4741, lng: -118.7956 },
  { id: "rs-45", name: "Fallon Youth Club", category: "Family Services", county: "Churchill", city: "Fallon", address: "324 Pennington Circle, Fallon, NV 89406", phone: "(775) 423-6926", lat: 39.46824, lng: -118.76307 },
  { id: "rs-46", name: "William Pennington Life Center", category: "Senior Services", county: "Churchill", city: "Fallon", address: "952 S. Maine Street, Fallon, NV 89406", phone: "(775) 423-7096", lat: 39.46608, lng: -118.77779 },
  { id: "rs-47", name: "EmployNV Business/Career Hub", category: "Employment", county: "Churchill", city: "Fallon", address: "121 Industrial Way, Fallon, NV 89406", phone: "(775) 423-5115", lat: 39.47372, lng: -118.79683 },
  { id: "rs-48", name: "Central Nevada Health District", category: "Physical Health", county: "Churchill", city: "Fallon", address: "485 West B Street, Suite #101, Fallon, NV 89406", lat: 39.47352, lng: -118.78315 },
  { id: "rs-49", name: "Fallon Family Wellness Center", category: "Physical Health", county: "Churchill", city: "Fallon", address: "2040 Reno Highway #400, Fallon, NV 89406", phone: "(775) 423-3392", lat: 39.48154, lng: -118.80802 },
  // 1490 Grimes St → same as rs-42
  { id: "rs-50", name: "New Frontier Treatment Center", category: "Substance Use", county: "Churchill", city: "Fallon", address: "1490 Grimes Street, Fallon, NV 89406", phone: "(775) 423-1412", lat: 39.47173, lng: -118.7948 },
  { id: "rs-51", name: "Fallon Family Wellness Center (MH)", category: "Mental Health", county: "Churchill", city: "Fallon", address: "903 Taylor Place, Fallon, NV 89406", phone: "(775) 423-3392", lat: 39.4757, lng: -118.8049 },
  { id: "rs-52", name: "DPBH-Rural Clinics: Fallon", category: "Mental Health", county: "Churchill", city: "Fallon", address: "141 Keddie Street, Fallon, NV 89406", phone: "(775) 687-2297", lat: 39.4832, lng: -118.77801 },

  // ── Douglas ──
  { id: "rs-53", name: "Douglas County Social Services", category: "Coordinated Entry", county: "Douglas", city: "Gardnerville", address: "2300 Meadow Lane, Gardnerville, NV 89410", phone: "(775) 782-9825", lat: 38.93181, lng: -119.72251 },
  { id: "rs-54", name: "Douglas County Social Services (Emergency Housing)", category: "Shelter", county: "Douglas", city: "Gardnerville", address: "1133 Spruce Street, Gardnerville, NV 89410", phone: "(775) 782-9825", lat: 38.93291, lng: -119.72481 },
  { id: "rs-55", name: "Carson Valley Community Food Closet", category: "Food", county: "Douglas", city: "Gardnerville", address: "1255 Waterloo Lane, Gardnerville, NV 89410", phone: "(775) 782-3711", lat: 38.93514, lng: -119.73418 },
  { id: "rs-56", name: "The Outreach Program-Our Lady of Tahoe", category: "Food", county: "Douglas", city: "Zephyr Cove", address: "1 Elks Point Road, Zephyr Cove, NV 89448", phone: "(775) 588-2080", lat: 38.9825, lng: -119.94599 },
  // 1516 US-395 N → 38.9500, -119.7520
  { id: "rs-57", name: "Family Support Council", category: "Family Services", county: "Douglas", city: "Gardnerville", address: "1516 U.S. Highway 395 N, Suite E & F, Gardnerville, NV 89410", phone: "(775) 782-8692", lat: 38.95531, lng: -119.74955 },
  { id: "rs-58", name: "Tahoe Youth & Family Services", category: "Family Services", county: "Douglas", city: "Gardnerville", address: "1512 U.S. Highway 395 N, Suite #3, Gardnerville, NV 89410", phone: "(775) 782-4202", lat: 38.95484, lng: -119.74961 },
  { id: "rs-59", name: "FISH Ranchos Family Services", category: "Family Services", county: "Douglas", city: "Gardnerville", address: "921 Mitch Drive, Gardnerville, NV 89460", phone: "(775) 265-3474", lat: 38.89531, lng: -119.74211 },
  // 1329 Waterloo Ln → 38.9455, -119.7475
  { id: "rs-60", name: "Douglas County Community & Senior Center", category: "Senior Services", county: "Douglas", city: "Gardnerville", address: "1329 Waterloo Lane, Gardnerville, NV 89410", phone: "(775) 782-5500", lat: 38.93512, lng: -119.73581 },
  { id: "rs-61", name: "Carson Valley Health Senior Care", category: "Senior Services", county: "Douglas", city: "Gardnerville", address: "1515 Virginia Ranch Road, Gardnerville, NV 89410", phone: "(775) 783-4823", lat: 38.95671, lng: -119.73955 },
  { id: "rs-62", name: "Douglas County Community Health Nurse", category: "Physical Health", county: "Douglas", city: "Gardnerville", address: "1329 Waterloo Lane, Gardnerville, NV 89410", phone: "(775) 782-9038", lat: 38.93512, lng: -119.73581 },
  { id: "rs-63", name: "Washoe Tribal Health Center", category: "Physical Health", county: "Douglas", city: "Gardnerville", address: "1559 Watasheamu, Gardnerville, NV 89460", phone: "(775) 265-4215", lat: 38.82512, lng: -119.68814 },
  // 1107 US-395 N → matches h14: 38.9413, -119.7496
  { id: "rs-64", name: "Carson Valley Health Outpatient BH Clinic", category: "Substance Use", county: "Douglas", city: "Gardnerville", address: "1107 US Highway 395 North, Gardnerville, NV 89410", phone: "(775) 782-1630", lat: 38.9413, lng: -119.7496 },
  { id: "rs-65", name: "DPBH-Rural Clinics: Douglas", category: "Mental Health", county: "Douglas", city: "Gardnerville", address: "1528 Highway 395, Ste. 100, Gardnerville, NV 89410", phone: "(775) 687-2160", lat: 38.95591, lng: -119.75011 },
  { id: "rs-66", name: "Community Counseling Center Douglas", category: "Mental Health", county: "Douglas", city: "Gardnerville", address: "1482 US Highway 395 South, Gardnerville, NV 89410", phone: "(775) 882-3945", lat: 38.94151, lng: -119.74311 },

  // ── Elko ──
  // 821 Water St → 40.8324, -115.7631
  { id: "rs-67", name: "Elko FISH", category: "Coordinated Entry", county: "Elko", city: "Elko", address: "821 Water Street, Elko, NV 89801", phone: "(775) 782-9825", lat: 40.83234, lng: -115.75529 },
  { id: "rs-68", name: "Elko FISH Emergency Shelter", category: "Shelter", county: "Elko", city: "Elko", address: "821 Water Street, Elko, NV 89801", phone: "(775) 738-3038", lat: 40.83234, lng: -115.75529 },
  { id: "rs-69", name: "Vitality Unlimited - High Desert Housing", category: "Supportive Housing", county: "Elko", city: "Elko", address: "1250 Lamoille Highway, Suite 943, Elko, NV 89801", phone: "(775) 389-5832", lat: 40.82994, lng: -115.74527 },
  { id: "rs-70", name: "Nevada Legal Services Elko", category: "Legal", county: "Elko", city: "Elko", address: "285 10th Street, Elko, NV 89801", phone: "(775) 753-5880", lat: 40.83539, lng: -115.75707 },
  // 821 Water St → same as rs-67/68
  { id: "rs-71", name: "FISH Food Pantry Elko", category: "Food", county: "Elko", city: "Elko", address: "821 Water Street, Elko, NV 89801", phone: "(775) 738-3038", lat: 40.83234, lng: -115.75529 },
  // 1010 Ruby Vista Dr → 40.8390, -115.7500
  { id: "rs-72", name: "DCFS Elko", category: "Family Services", county: "Elko", city: "Elko", address: "1010 Ruby Vista Drive, Suite 101, Elko, NV 89801", phone: "(775) 753-1300", lat: 40.86702, lng: -115.73284 },
  { id: "rs-73", name: "Family Resource Center of NE Nevada", category: "Family Services", county: "Elko", city: "Elko", address: "331 Seventh Street, Elko, NV 89801", phone: "(775) 753-7352", lat: 40.83512, lng: -115.76011 },
  { id: "rs-74", name: "Elko Senior Citizen Center", category: "Senior Services", county: "Elko", city: "Elko", address: "1795 Ruby View Drive, Elko, NV 89801", phone: "(775) 738-3030", lat: 40.84951, lng: -115.75804 },
  { id: "rs-75", name: "Employ NV Business/Career Hub Elko", category: "Employment", county: "Elko", city: "Elko", address: "172 6th Street, Elko, NV 89801", phone: "(775) 753-1900", lat: 40.83185, lng: -115.75979 },
  // 1010 Ruby Vista Dr → same as rs-72
  { id: "rs-76", name: "Aging and Disability Services Division Elko", category: "Disability Services", county: "Elko", city: "Elko", address: "1010 Ruby Vista Drive, Suite 104, Elko, NV 89801", phone: "(775) 738-1966", lat: 40.86702, lng: -115.73284 },
  { id: "rs-78", name: "Elko Community Health Center", category: "Physical Health", county: "Elko", city: "Elko", address: "2098 Idaho Street, Elko, NV 89801", phone: "(775) 389-5778", lat: 40.84808, lng: -115.74731 },
  { id: "rs-79", name: "Wendover Community Health Center", category: "Physical Health", county: "Elko", city: "West Wendover", address: "925 Wells Avenue, West Wendover, NV 89883", phone: "(775) 664-2220", lat: 40.73971, lng: -114.07567 },
  { id: "rs-80", name: "Carlin Community Health Center", category: "Physical Health", county: "Elko", city: "Carlin", address: "310 Memory Lane, Carlin, NV 89822", phone: "(775) 754-2666", lat: 40.7140, lng: -116.1040 },
  { id: "rs-81", name: "Jackpot Community Health Center", category: "Physical Health", county: "Elko", city: "Jackpot", address: "950 Lady Luck Drive, Jackpot, NV 89825", phone: "(775) 755-2500", lat: 41.98986, lng: -114.6656 },
  { id: "rs-82", name: "Ruby Mountain Recovery", category: "Substance Use", county: "Elko", city: "Elko", address: "1009 Silver Street, Elko, NV 89801", phone: "(775) 753-6258", lat: 40.83528, lng: -115.75638 },
  { id: "rs-83", name: "Vitality Unlimited - Vitality Center", category: "Substance Use", county: "Elko", city: "Elko", address: "3740 Idaho Street, Elko, NV 89801", phone: "(775) 738-8004", lat: 40.86077, lng: -115.73694 },
  { id: "rs-84", name: "Vitality Integrated Programs (VIP)", category: "Mental Health", county: "Elko", city: "Elko", address: "215 Bluffs Avenue, Suites 100-200, Elko, NV 89801", phone: "(775) 777-8477", lat: 40.84151, lng: -115.77611 },
  { id: "rs-85", name: "DPBH-Rural Clinics: Elko", category: "Mental Health", county: "Elko", city: "Elko", address: "1825 Pinion Road, Suite A, Elko, NV 89801", phone: "(775) 738-8021", lat: 40.83164, lng: -115.73502 },

  // ── Esmeralda ──
  { id: "rs-86", name: "Nevada Outreach Training Organization", category: "Coordinated Entry", county: "Esmeralda", city: "Goldfield", address: "Goldfield, NV 89013", phone: "(775) 751-1118", lat: 37.7085, lng: -117.2354, notes: "city-center approx; no street address available" },
  { id: "rs-87", name: "Consolidated Agencies of Human Services", category: "Family Services", county: "Esmeralda", city: "Hawthorne", address: "924 5th Street, Hawthorne, NV 89415", phone: "(775) 945-2471", lat: 38.5260, lng: -118.6290, notes: "Serves Esmeralda from Hawthorne" },

  // ── Eureka ──
  { id: "rs-88", name: "Churchill County Social Services (serves Eureka)", category: "Coordinated Entry", county: "Eureka", city: "Eureka", address: "Eureka, NV 89316", phone: "(775) 423-1412", lat: 39.5130, lng: -115.9610, notes: "city-center approx; served remotely from Churchill" },
  { id: "rs-89", name: "Food Pantry by Eureka Senior Center", category: "Food", county: "Eureka", city: "Eureka", address: "20 Gold Street, Eureka, NV 89316", phone: "(775) 237-5597", lat: 39.5130, lng: -115.9610 },
  { id: "rs-90", name: "White Pine County Social Services (serves Eureka)", category: "Family Services", county: "Eureka", city: "Ely", address: "297 11th Street, Ely, NV 89301", phone: "(775) 293-6528", lat: 39.24987, lng: -114.88695 },
  // 20 W Gold St → same as rs-89
  { id: "rs-91", name: "Eureka Senior Citizen Center", category: "Senior Services", county: "Eureka", city: "Eureka", address: "20 W. Gold Street, Eureka, NV 89316", phone: "(775) 237-5597", lat: 39.51167, lng: -115.96103 },
  { id: "rs-92", name: "Eureka County Medical Clinic", category: "Physical Health", county: "Eureka", city: "Eureka", address: "250 S Main Street, Eureka, NV 89316", phone: "(775) 237-5642", lat: 39.50343, lng: -115.95942 },
  { id: "rs-93", name: "Central Nevada Health District Eureka", category: "Physical Health", county: "Eureka", city: "Eureka", address: "351 NV-278, Eureka, NV 89316", phone: "(775) 254-0305", lat: 39.55404, lng: -115.98993 },

  // ── Humboldt ──
  { id: "rs-94", name: "Winnemucca Domestic Violence Services", category: "Shelter", county: "Humboldt", city: "Winnemucca", address: "50 A Melarkey Street, Winnemucca, NV 89445", phone: "(775) 625-1313", lat: 40.96732, lng: -117.7247 },
  { id: "rs-95", name: "Frontier Community Coalition (FCC)", category: "Supportive Housing", county: "Humboldt", city: "Winnemucca", address: "667 Anderson Street, Winnemucca, NV 89445", phone: "(775) 374-5638", lat: 40.96364, lng: -117.73783 },
  { id: "rs-96", name: "Soup Kitchen - Winnemucca United Methodist", category: "Food", county: "Humboldt", city: "Winnemucca", address: "138 West Winnemucca Boulevard, Winnemucca, NV 89445", phone: "(775) 623-2814", lat: 40.97259, lng: -117.73661 },
  { id: "rs-97", name: "St. Paul's Catholic Church Food Pantry", category: "Food", county: "Humboldt", city: "Winnemucca", address: "350 Melarkey Street, Winnemucca, NV 89445", phone: "(775) 623-2928", lat: 40.97207, lng: -117.7351 },
  { id: "rs-98", name: "Food Bank of Winnemucca", category: "Food", county: "Humboldt", city: "Winnemucca", address: "150 S. Bridge Street, Winnemucca, NV 89445", phone: "(775) 625-2223", lat: 40.9743, lng: -117.73657 },
  { id: "rs-99", name: "The Family Support Center", category: "Family Services", county: "Humboldt", city: "Winnemucca", address: "1200 E Winnemucca Boulevard, Winnemucca, NV 89445", phone: "(775) 623-1888", lat: 40.97564, lng: -117.71863 },
  // 475 W Haskell St → 40.9710, -117.7400
  { id: "rs-100", name: "DCFS Humboldt", category: "Family Services", county: "Humboldt", city: "Winnemucca", address: "475 W. Haskell Street, Winnemucca, NV 89445", phone: "(775) 623-6555", lat: 40.96464, lng: -117.73386 },
  { id: "rs-101", name: "Senior Citizens of Humboldt", category: "Senior Services", county: "Humboldt", city: "Winnemucca", address: "1480 Lay Street, Winnemucca, NV 89445", phone: "(775) 623-6211", lat: 40.96662, lng: -117.72486 },
  { id: "rs-102", name: "Elwood Staffing", category: "Employment", county: "Humboldt", city: "Winnemucca", address: "3013 Potato Rd Suite #C, Winnemucca, NV 89445", phone: "(775) 623-2113", lat: 40.96311, lng: -117.75812 },
  // 475 W Haskell St → same as rs-100
  { id: "rs-103", name: "EmployNV Business/Career Hub Winnemucca", category: "Employment", county: "Humboldt", city: "Winnemucca", address: "475 W Haskell Street Suite 1, Winnemucca, NV 89445", phone: "(775) 623-6520", lat: 40.96464, lng: -117.73386 },
  { id: "rs-105", name: "Golden Valley Medical Center", category: "Physical Health", county: "Humboldt", city: "Winnemucca", address: "515 W Haskell Street, Winnemucca, NV 89445", phone: "(775) 625-4653", lat: 40.9657, lng: -117.73218 },
  { id: "rs-106", name: "Silver Sage Counseling Services", category: "Substance Use", county: "Humboldt", city: "Winnemucca", address: "530 Melarkey Suite #202, Winnemucca, NV 89445", phone: "(775) 623-3626", lat: 40.97232, lng: -117.73481 },
  { id: "rs-107", name: "Winnemucca Mental Health Center", category: "Mental Health", county: "Humboldt", city: "Winnemucca", address: "3140 Traders Way, Winnemucca, NV 89445", phone: "(775) 623-6580", lat: 40.95764, lng: -117.744 },
  // 475 W Haskell St → same as rs-100
  { id: "rs-108", name: "DPBH-Rural Clinics: Winnemucca", category: "Mental Health", county: "Humboldt", city: "Winnemucca", address: "475 W. Haskell Street, Winnemucca, NV 89445", phone: "(775) 687-2150", lat: 40.96464, lng: -117.73386 },

  // ── Lander ──
  { id: "rs-109", name: "Frontier Community Coalition (Lander)", category: "Supportive Housing", county: "Lander", city: "Battle Mountain", address: "667 Anderson Street, Winnemucca, NV 89445", phone: "(775) 374-5638", lat: 40.96364, lng: -117.73783, notes: "Serves Lander from Winnemucca" },
  { id: "rs-110", name: "Assembly of God Helping Hands", category: "Food", county: "Lander", city: "Battle Mountain", address: "289 Stone Avenue, Battle Mountain, NV 89820", phone: "(775) 635-2162", lat: 40.63581, lng: -116.92954 },
  { id: "rs-111", name: "Battle Mountain Family Resource Center", category: "Food", county: "Lander", city: "Battle Mountain", address: "370 S. Mountain Street, Battle Mountain, NV 89820", phone: "(775) 635-8302", lat: 40.63914, lng: -116.94112 },
  // 1005 E Broadway Ave, Lovelock → 40.1793, -118.4734 (co-located in Pershing)
  { id: "rs-112", name: "Frontier Community Coalition (Family)", category: "Family Services", county: "Lander", city: "Lovelock", address: "1005 E Broadway Avenue, Lovelock, NV 89419", phone: "(775) 273-2400", lat: 40.1793, lng: -118.4734, notes: "Serves Lander from Lovelock" },
  { id: "rs-113", name: "Senior Citizen Center Battle Mountain", category: "Senior Services", county: "Lander", city: "Battle Mountain", address: "365 E 4th Street, Battle Mountain, NV 89820", phone: "(775) 635-5311", lat: 40.64152, lng: -116.93211 },
  // 825 N 2nd St → 40.6450, -116.9350
  { id: "rs-114", name: "Lander County Community Health Nurse", category: "Physical Health", county: "Lander", city: "Battle Mountain", address: "825 N 2nd Street, Battle Mountain, NV 89820", phone: "(775) 635-2386", lat: 40.64811, lng: -116.93651 },
  { id: "rs-115", name: "Austin Medical Clinic", category: "Physical Health", county: "Lander", city: "Austin", address: "121 Main Street, Austin, NV 89310", phone: "(775) 964-2222", lat: 39.49191, lng: -117.07028 },
  // 825 N 2nd St → same as rs-114
  { id: "rs-116", name: "DPBH-Rural Clinics: Battle Mountain", category: "Mental Health", county: "Lander", city: "Battle Mountain", address: "825 North 2nd Street, Battle Mountain, NV 89820", phone: "(775) 635-5753", lat: 40.64811, lng: -116.93651 },

  // ── Lincoln ──
  { id: "rs-117", name: "Nevada Outreach Training Organization", category: "Coordinated Entry", county: "Lincoln", city: "Pioche", address: "Pioche, NV 89043", phone: "(775) 751-1118", lat: 37.9296, lng: -114.4524, notes: "city-center approx; no street address available" },
  { id: "rs-118", name: "Emergency Food Assistance - Lincoln County", category: "Food", county: "Lincoln", city: "Pioche", address: "Pioche, NV 89043", phone: "(775) 962-8084", lat: 37.9296, lng: -114.4524, notes: "city-center approx; no street address available" },
  { id: "rs-119", name: "Lincoln County Community Connection", category: "Food", county: "Lincoln", city: "Caliente", address: "30 Lincoln Street, Caliente, NV 89008", phone: "(775) 726-3325", lat: 37.61511, lng: -114.51214 },
  { id: "rs-120", name: "Alamo Senior Center", category: "Senior Services", county: "Lincoln", city: "Alamo", address: "759 Box Canyon Road, Alamo, NV 89001", phone: "(775) 725-3340", lat: 37.35915, lng: -115.18725 },
  { id: "rs-121", name: "Pioche Senior Center", category: "Senior Services", county: "Lincoln", city: "Pioche", address: "410 Field Street, Pioche, NV 89043", phone: "(775) 962-5378", lat: 37.93337, lng: -114.44997 },
  { id: "rs-122", name: "Caliente Olson Senior Center", category: "Senior Services", county: "Lincoln", city: "Caliente", address: "240 Front Street, Caliente, NV 89008", phone: "(775) 726-3740", lat: 37.61211, lng: -114.51581 },
  { id: "rs-123", name: "EmployNV Career Hub Lincoln County", category: "Employment", county: "Lincoln", city: "Caliente", address: "Caliente, NV 89008", phone: "(775) 726-3800", lat: 37.6147, lng: -114.5119, notes: "city-center approx; no street address available" },
  // 700 N Spring St → matches h10: 37.6226, -114.5136
  { id: "rs-124", name: "Lincoln County Medical Associates - Caliente", category: "Physical Health", county: "Lincoln", city: "Caliente", address: "700 N Spring Street, Caliente, NV 89008", phone: "(775) 726-8051", lat: 37.6226, lng: -114.5136 },
  { id: "rs-125", name: "Lincoln County Medical Associates - Alamo", category: "Physical Health", county: "Lincoln", city: "Alamo", address: "33 Joshua Tree Street, Alamo, NV 89001", phone: "(775) 726-8059", lat: 37.36136, lng: -115.16777 },
  { id: "rs-127", name: "DPBH-Rural Clinics: Panaca", category: "Mental Health", county: "Lincoln", city: "Panaca", address: "1005 Main Street, Suite 111, Panaca, NV 89042", phone: "(775) 962-8089", lat: 37.79045, lng: -114.38876 },

  // ── Lyon ──
  // 620 Lake Ave, Silver Springs → 39.4150, -119.2250
  { id: "rs-128", name: "Lyon County Human Services", category: "Coordinated Entry", county: "Lyon", city: "Silver Springs", address: "620 Lake Avenue, Silver Springs, NV 89429", phone: "(775) 577-5009", lat: 39.40812, lng: -119.23121 },
  // 1075 Pyramid St → 39.4155, -119.2255
  { id: "rs-129", name: "Lyon County Human Services (Emergency Shelter)", category: "Shelter", county: "Lyon", city: "Silver Springs", address: "1075 Pyramid Street, Silver Springs, NV 89429", lat: 39.40311, lng: -119.22811 },
  { id: "rs-130", name: "Lyon County Human Services (RRH)", category: "Supportive Housing", county: "Lyon", city: "Silver Springs", address: "1075 Pyramid Street, Silver Springs, NV 89429", lat: 39.40311, lng: -119.22811 },
  // 720 S Main St → 38.9858, -119.1630
  { id: "rs-131", name: "Nevada Legal Services Lyon", category: "Legal", county: "Lyon", city: "Yerington", address: "720 S. Main Street, Suite A, Yerington, NV 89447", phone: "(775) 463-1222", lat: 38.97797, lng: -119.16317 },
  { id: "rs-132", name: "Lyon County CASA", category: "Legal", county: "Lyon", city: "Yerington", address: "31 S Main Street, Yerington, NV 89447", phone: "(775) 344-1411", lat: 38.98655, lng: -119.1633 },
  { id: "rs-133", name: "St. Robert Bellarmine Parish", category: "Food", county: "Lyon", city: "Fernley", address: "625 Desert Shadows Lane, Fernley, NV 89408", phone: "(775) 575-4011", lat: 39.57495, lng: -119.2389 },
  { id: "rs-134", name: "Healthy Communities Coalition - Dayton", category: "Food", county: "Lyon", city: "Dayton", address: "209 Dayton Valley Road, Dayton, NV 89403", phone: "(775) 246-7834", lat: 39.2374, lng: -119.5929 },
  { id: "rs-135", name: "Healthy Communities Coalition - Silver Springs", category: "Food", county: "Lyon", city: "Silver Springs", address: "1290 Lahontan Street, Silver Springs, NV 89429", phone: "(775) 577-9161", lat: 39.40751, lng: -119.22154 },
  { id: "rs-136", name: "Healthy Communities Coalition - Yerington", category: "Food", county: "Lyon", city: "Yerington", address: "502 W. Bridge Street, Yerington, NV 89447", phone: "(775) 350-4597", lat: 38.98304, lng: -119.16892 },
  { id: "rs-137", name: "DCFS Fernley", category: "Family Services", county: "Lyon", city: "Fernley", address: "55 North Center Street #3, Fernley, NV 89408", phone: "(775) 575-1844", lat: 39.60845, lng: -119.25228 },
  { id: "rs-138", name: "DCFS Yerington", category: "Family Services", county: "Lyon", city: "Yerington", address: "205 West Goldfield Avenue, Yerington, NV 89447", phone: "(775) 463-3151", lat: 38.9858, lng: -119.1638 },
  { id: "rs-139", name: "Lyon County Senior Center Fernley", category: "Senior Services", county: "Lyon", city: "Fernley", address: "105 Lois Lane, Fernley, NV 89408", phone: "(775) 575-3370", lat: 39.6037, lng: -119.23679 },
  { id: "rs-140", name: "Lyon County Senior Center Yerington", category: "Senior Services", county: "Lyon", city: "Yerington", address: "117 Tilson Rd, Yerington, NV 89447", phone: "(775) 463-6550", lat: 38.95912, lng: -119.16244 },
  { id: "rs-141", name: "Fernley EmployNV Career Hub", category: "Employment", county: "Lyon", city: "Fernley", address: "1320 W Newlands Dr, Fernley, NV 89408", phone: "(775) 439-3077", lat: 39.6112, lng: -119.22291 },
  { id: "rs-142", name: "Dayton Community Health Nurse", category: "Physical Health", county: "Lyon", city: "Dayton", address: "5 Pinecone Road, Suite 103, Dayton, NV 89403", phone: "(775) 246-6211", lat: 39.23812, lng: -119.58911 },
  { id: "rs-144", name: "Banner Health Center Fernley", category: "Physical Health", county: "Lyon", city: "Fernley", address: "1260 Nevada Pacific Boulevard, Fernley, NV 89408", phone: "(775) 575-7171", lat: 39.59788, lng: -119.19768 },
  { id: "rs-145", name: "Rural Nevada Counseling - Dayton", category: "Substance Use", county: "Lyon", city: "Dayton", address: "801 Overland Loop, Suite 201, Dayton, NV 89403", phone: "(775) 241-9285", lat: 39.24351, lng: -119.57881 },
  // 720 S Main St → same as rs-131
  { id: "rs-146", name: "Rural Nevada Counseling - Yerington", category: "Mental Health", county: "Lyon", city: "Yerington", address: "720 S. Main Street, Suite C, Yerington, NV 89447", phone: "(775) 463-6597", lat: 38.97797, lng: -119.16317 },
  // 5 Pinecone Rd → same as rs-142
  { id: "rs-147", name: "DPBH-Rural Clinics: Dayton", category: "Mental Health", county: "Lyon", city: "Dayton", address: "5 Pinecone Road #103, Dayton, NV 89403", phone: "(775) 461-3769", lat: 39.23812, lng: -119.58911 },
  { id: "rs-148", name: "DPBH-Rural Clinics: Fernley", category: "Mental Health", county: "Lyon", city: "Fernley", address: "415 Highway 95A, Building I, Fernley, NV 89408", phone: "(775) 687-2350", lat: 39.60851, lng: -119.23612 },
  { id: "rs-149", name: "DPBH-Rural Clinics: Yerington", category: "Mental Health", county: "Lyon", city: "Yerington", address: "215 W. Bridge Street, Suite 5, Yerington, NV 89447", phone: "(775) 687-2199", lat: 38.98286, lng: -119.1659 },

  // ── Mineral ──
  { id: "rs-150", name: "Lyon County Human Services (serves Mineral)", category: "Coordinated Entry", county: "Mineral", city: "Hawthorne", address: "Hawthorne, NV 89415", phone: "(775) 577-5009", lat: 38.53303, lng: -118.62137, notes: "city-center approx; served remotely from Lyon" },
  { id: "rs-151", name: "SNAP - Dept of Welfare Mineral", category: "Food", county: "Mineral", city: "Hawthorne", address: "1000 C Street, Hawthorne, NV 89415", phone: "(775) 945-3602", lat: 38.52912, lng: -118.63111 },
  // 924 5th St → 38.5260, -118.6290
  { id: "rs-152", name: "Consolidated Agencies of Human Services (WIC)", category: "Food", county: "Mineral", city: "Hawthorne", address: "924 5th Street, Hawthorne, NV 89415", phone: "(775) 945-2471", lat: 38.52781, lng: -118.62411 },
  { id: "rs-153", name: "Mineral County Youth & Family Services", category: "Family Services", county: "Mineral", city: "Hawthorne", address: "314 W Fifth Street, Hawthorne, NV", phone: "(775) 945-3393", lat: 38.52731, lng: -118.62881 },
  { id: "rs-154", name: "Mineral County Senior Center", category: "Senior Services", county: "Mineral", city: "Hawthorne", address: "975 K Street, Hawthorne, NV 89415", phone: "(775) 945-5519", lat: 38.53303, lng: -118.62137 },
  // 1000 C St → same as rs-151
  { id: "rs-155", name: "Dept of Welfare and Support Services", category: "Disability Services", county: "Mineral", city: "Hawthorne", address: "1000 C Street, Hawthorne, NV 89415", phone: "(775) 945-3602", lat: 38.53303, lng: -118.62137 },
  { id: "rs-156", name: "Mineral County Health Nurse", category: "Physical Health", county: "Mineral", city: "Hawthorne", address: "331 1st Street, Hawthorne, NV 89415", phone: "(775) 945-3657", lat: 38.52411, lng: -118.62651 },
  // 200 S A St → matches h8: 38.5166, -118.6274
  { id: "rs-157", name: "Mt. Grant General Hospital", category: "Physical Health", county: "Mineral", city: "Hawthorne", address: "200 South A Street, Hawthorne, NV 89415", phone: "(775) 945-2461", lat: 38.5166, lng: -118.6274 },

  // ── Nye ──
  { id: "rs-158", name: "Nevada Outreach Training Organization", category: "Coordinated Entry", county: "Nye", city: "Pahrump", address: "1397 E Calvada Blvd, Pahrump, NV 89048", phone: "(775) 751-1118", lat: 36.2080, lng: -115.9840, notes: "co-located with Family Centers of Nevada" },
  { id: "rs-159", name: "Nye County Social Services", category: "Shelter", county: "Nye", city: "Pahrump", address: "1981 E Calvada Blvd, Pahrump, NV 89048", phone: "(775) 751-7075", lat: 36.2078, lng: -115.9720, notes: "street-level approx" },
  { id: "rs-160", name: "NyE Communities Coalition", category: "Food", county: "Nye", city: "Pahrump", address: "1600 E Calvada Blvd, Pahrump, NV 89048", phone: "(775) 727-9970", lat: 36.2080, lng: -115.9780, notes: "street-level approx" },
  { id: "rs-161", name: "DCFS Nye County", category: "Family Services", county: "Nye", city: "Pahrump", address: "1981 E Calvada Blvd, Pahrump, NV 89048", phone: "(775) 751-7300", lat: 36.2078, lng: -115.9720, notes: "co-located with Nye County Social Services" },
  { id: "rs-162", name: "Pahrump Senior Center", category: "Senior Services", county: "Nye", city: "Pahrump", address: "1370 W Basin Ave, Pahrump, NV 89060", phone: "(775) 727-5008", lat: 36.2058, lng: -116.0100, notes: "street-level approx" },
  // 360 S Lola Ln → matches h1: 36.2142, -116.0248
  { id: "rs-164", name: "Desert View Hospital BH Services", category: "Mental Health", county: "Nye", city: "Pahrump", address: "360 S Lola Ln, Pahrump, NV", phone: "(775) 751-7500", lat: 36.2142, lng: -116.0248 },

  // ── Pershing ──
  // 1005 E Broadway Ave → 40.1793, -118.4734
  { id: "rs-165", name: "Frontier Community Coalition (Pershing)", category: "Coordinated Entry", county: "Pershing", city: "Lovelock", address: "1005 E Broadway Avenue, Lovelock, NV 89419", phone: "(775) 273-2400", lat: 40.1793, lng: -118.4734 },
  { id: "rs-166", name: "Frontier Community Coalition (Family)", category: "Family Services", county: "Pershing", city: "Lovelock", address: "1005 E Broadway Avenue, Lovelock, NV 89419", phone: "(775) 273-2400", lat: 40.1793, lng: -118.4734 },
  { id: "rs-167", name: "Pershing County Senior Center", category: "Senior Services", county: "Pershing", city: "Lovelock", address: "1075 Dartmouth Ave, Lovelock, NV 89419", phone: "(775) 273-2284", lat: 40.1793, lng: -118.4750, notes: "street-level approx" },
  // 855 6th St → matches h11: 40.1762, -118.4818
  { id: "rs-168", name: "Pershing General Hospital", category: "Physical Health", county: "Pershing", city: "Lovelock", address: "855 6th St, Lovelock, NV 89419", phone: "(775) 273-2621", lat: 40.1762, lng: -118.4818 },

  // ── Storey ──
  { id: "rs-169", name: "Lyon County Human Services (serves Storey)", category: "Coordinated Entry", county: "Storey", city: "Virginia City", address: "Virginia City, NV 89440", phone: "(775) 577-5009", lat: 39.3096, lng: -119.6500, notes: "city-center approx; served remotely from Lyon" },
  { id: "rs-170", name: "Storey County Human Services", category: "Family Services", county: "Storey", city: "Virginia City", address: "26 S B St, Virginia City, NV 89440", phone: "(775) 847-1140", lat: 39.3096, lng: -119.6500, notes: "street-level approx" },
  { id: "rs-171", name: "Storey County Senior Center", category: "Senior Services", county: "Storey", city: "Virginia City", address: "145 N C St, Virginia City, NV 89440", phone: "(775) 847-0956", lat: 39.3110, lng: -119.6490, notes: "street-level approx" },

  // ── White Pine ──
  // 297 11th St → 39.2480, -114.8870
  { id: "rs-172", name: "White Pine County Social Services", category: "Coordinated Entry", county: "White Pine", city: "Ely", address: "297 11th Street, Ely, NV 89301", phone: "(775) 293-6528", lat: 39.24581, lng: -114.88711 },
  { id: "rs-173", name: "White Pine County Social Services (Shelter)", category: "Shelter", county: "White Pine", city: "Ely", address: "297 11th Street, Ely, NV 89301", phone: "(775) 293-6528", lat: 39.24987, lng: -114.88695 },
  { id: "rs-174", name: "Nevada Legal Services Ely", category: "Legal", county: "White Pine", city: "Ely", address: "725 Railroad St, Ely, NV 89301", phone: "(775) 289-8522", lat: 39.2480, lng: -114.8870, notes: "street-level approx" },
  { id: "rs-175", name: "White Pine Food Pantry", category: "Food", county: "White Pine", city: "Ely", address: "59 Campton St, Ely, NV 89301", phone: "(775) 289-4091", lat: 39.2480, lng: -114.8860, notes: "street-level approx" },
  { id: "rs-176", name: "DCFS White Pine", category: "Family Services", county: "White Pine", city: "Ely", address: "1010 E Aultman St, Ely, NV 89301", phone: "(775) 289-1640", lat: 39.24831, lng: -114.87812 },
  { id: "rs-177", name: "White Pine Senior Center", category: "Senior Services", county: "White Pine", city: "Ely", address: "1900 Bobcat Dr, Ely, NV 89301", phone: "(775) 289-3582", lat: 39.2530, lng: -114.8750, notes: "street-level approx" },
  { id: "rs-180", name: "DPBH-Rural Clinics: Ely", category: "Mental Health", county: "White Pine", city: "Ely", address: "1010 E Aultman St, Ely, NV 89301", phone: "(775) 289-1640", lat: 39.24831, lng: -114.87812, notes: "co-located with DCFS White Pine" },
];

/** Unique counties present in the rural services dataset */
export const ruralServiceCounties = [...new Set(ruralServices.map(s => s.county))].sort();
