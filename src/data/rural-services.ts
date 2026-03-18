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
  notes?: string;
  lat: number;
  lng: number;
}

// Small random-ish offsets to scatter pins within a county seat
const scatter = (base: number, i: number, scale = 0.008): number =>
  base + ((i * 7 + 3) % 11 - 5) * scale * 0.1;

export const ruralServices: RuralService[] = [
  // ── Carson City ──
  { id: "rs-1", name: "Carson City Health & Human Services", category: "Coordinated Entry", county: "Carson City", city: "Carson City", address: "900 East Long Street, Carson City, NV 89706", phone: "(775) 887-2110", lat: 39.1638, lng: -119.7674 },
  { id: "rs-2", name: "Advocates to End Domestic Violence", category: "Shelter", county: "Carson City", city: "Carson City", address: "3640 Gordon Street, Carson City, NV 89702", phone: "(775) 883-7654", lat: 39.1700, lng: -119.7720 },
  { id: "rs-3", name: "FISH - FOCUS House (Men's Shelter)", category: "Shelter", county: "Carson City", city: "Carson City", phone: "(775) 882-3474", lat: 39.1620, lng: -119.7700 },
  { id: "rs-4", name: "FISH - Wylie House (Women & Family)", category: "Shelter", county: "Carson City", city: "Carson City", phone: "(775) 882-3474", lat: 39.1610, lng: -119.7690 },
  { id: "rs-5", name: "Carson City Health & Human Services (PSH/RRH)", category: "Supportive Housing", county: "Carson City", city: "Carson City", address: "900 E. Long Street, Carson City, NV 89706", phone: "(775) 887-2110", lat: 39.1645, lng: -119.7680 },
  { id: "rs-6", name: "Nation's Finest - SSVF Program", category: "Supportive Housing", county: "Carson City", city: "Carson City", address: "106 E. Adams Street, Suite 203, Carson City, NV 89706", phone: "(775) 360-2155", lat: 39.1655, lng: -119.7660 },
  { id: "rs-7", name: "Volunteer Attorneys for Rural Nevadans (VARN)", category: "Legal", county: "Carson City", city: "Carson City", address: "412 W. John Street, Suite C, Carson City, NV 89703", phone: "(775) 883-8278", lat: 39.1670, lng: -119.7750 },
  { id: "rs-8", name: "Carson & Rural Elder Law Program (CARE)", category: "Legal", county: "Carson City", city: "Carson City", address: "2621 Northgate Lane, Suite 6, Carson City, NV 89706", phone: "(775) 687-4680", lat: 39.1690, lng: -119.7640 },
  { id: "rs-9", name: "Nevada Legal Services", category: "Legal", county: "Carson City", city: "Carson City", address: "209 N. Pratt, Carson City, NV 89701", phone: "(775) 883-0404", lat: 39.1660, lng: -119.7710 },
  { id: "rs-10", name: "LYFE Recovery", category: "Recovery/Boarding", county: "Carson City", city: "Carson City", address: "1655 N Edmonds Drive, Carson City, NV 89701", phone: "(844) 463-9593", lat: 39.1710, lng: -119.7630 },
  { id: "rs-11", name: "Northern Nevada Dream Center", category: "Food", county: "Carson City", city: "Carson City", address: "3579 U.S 50 #211, Carson City, NV 89701", phone: "(775) 443-4090", lat: 39.1580, lng: -119.7580 },
  { id: "rs-12", name: "Calvary Chapel Carson City", category: "Food", county: "Carson City", city: "Carson City", address: "1635 East Clearview Drive, Carson City, NV 89701", phone: "(775) 883-5215", lat: 39.1590, lng: -119.7560 },
  { id: "rs-13", name: "FISH Food Pantry", category: "Food", county: "Carson City", city: "Carson City", address: "138 E Long Street, Carson City, NV 89706", phone: "(775) 882-3474", lat: 39.1630, lng: -119.7695 },
  { id: "rs-14", name: "Community Essential Emergency Food Bank", category: "Food", county: "Carson City", city: "Carson City", address: "2621 Northgate Lane, Suite 62, Carson City, NV 89706", phone: "(775) 884-2269", lat: 39.1695, lng: -119.7645 },
  { id: "rs-15", name: "Carson City WIC", category: "Food", county: "Carson City", city: "Carson City", address: "900 East Long Street, Carson City, NV 89706", phone: "(775) 887-2190", lat: 39.1640, lng: -119.7678 },
  { id: "rs-16", name: "Ron Wood Family Resource Center", category: "Family Services", county: "Carson City", city: "Carson City", address: "2621 Northgate Lane, Carson City, NV 89706", phone: "(775) 884-2269", lat: 39.1692, lng: -119.7648 },
  { id: "rs-17", name: "Department of Children and Family Services (DCFS)", category: "Family Services", county: "Carson City", city: "Carson City", address: "2533 N Carson Suite #100, Carson City, NV 89706", phone: "(775) 684-1930", lat: 39.1720, lng: -119.7670 },
  { id: "rs-18", name: "The Children's Cabinet", category: "Family Services", county: "Carson City", city: "Carson City", address: "2527 N Carson Suite #255, Carson City, NV 89706", phone: "(775) 856-6200", lat: 39.1718, lng: -119.7672 },
  { id: "rs-19", name: "Family Wellness Center, LLC", category: "Family Services", county: "Carson City", city: "Carson City", address: "123 W Nye Lane Suite 525, Carson City, NV 89706", phone: "(775) 400-2996", lat: 39.1650, lng: -119.7700 },
  { id: "rs-20", name: "Carson City Senior Center", category: "Senior Services", county: "Carson City", city: "Carson City", address: "911 Beverly Drive, Carson City, NV 89706", phone: "(775) 883-0703", lat: 39.1625, lng: -119.7730 },
  { id: "rs-21", name: "Aging and Disability Services Division", category: "Senior Services", county: "Carson City", city: "Carson City", address: "1550 E College Parkway, Carson City, NV 89706", phone: "(775) 687-4210", lat: 39.1580, lng: -119.7620 },
  { id: "rs-22", name: "Employ NV", category: "Employment", county: "Carson City", city: "Carson City", address: "1929 N. Carson Street, Carson City, NV 89701", phone: "(775) 684-0400", lat: 39.1730, lng: -119.7680 },
  { id: "rs-23", name: "NV Vocational Rehabilitation", category: "Employment", county: "Carson City", city: "Carson City", address: "1933 N. Carson Street, Carson City, NV 89701", phone: "(775) 684-0425", lat: 39.1732, lng: -119.7682 },
  { id: "rs-24", name: "Aging and Disability Services Division", category: "Disability Services", county: "Carson City", city: "Carson City", address: "1550 E College Parkway, Carson City, NV 89706", phone: "(775) 687-4210", lat: 39.1582, lng: -119.7622 },
  { id: "rs-25", name: "Cancer Resource Center", category: "Physical Health", county: "Carson City", city: "Carson City", address: "1535 Medical Parkway, Carson City, NV 89703", phone: "(775) 445-7500", lat: 39.1560, lng: -119.7750 },
  { id: "rs-26", name: "Sierra Nevada Health Center", category: "Physical Health", county: "Carson City", city: "Carson City", address: "3325 Research Way, Carson City, NV 89706", phone: "(775) 887-5140", lat: 39.1550, lng: -119.7600 },
  { id: "rs-27", name: "Battle Born Counseling Center", category: "Substance Use", county: "Carson City", city: "Carson City", address: "1802 N Carson Street, Suite 103, Carson City, NV 89701", phone: "(775) 350-4809", lat: 39.1735, lng: -119.7685 },
  { id: "rs-28", name: "Vitality Carson City (Residential)", category: "Substance Use", county: "Carson City", city: "Carson City", address: "900 E Long Street, Carson City, NV 89706", phone: "(775) 461-0999", lat: 39.1642, lng: -119.7676 },
  { id: "rs-29", name: "Community Counseling Center", category: "Substance Use", county: "Carson City", city: "Carson City", address: "205 S Pratt Avenue, Carson City, NV 89701", phone: "(775) 882-3945", lat: 39.1615, lng: -119.7705 },
  { id: "rs-30", name: "The Life Change Center", category: "Substance Use", county: "Carson City", city: "Carson City", address: "1201 N Stewart Street, Carson City, NV 89701", phone: "(775) 350-7250", lat: 39.1680, lng: -119.7660 },
  { id: "rs-31", name: "DPBH-Rural Clinics: Carson City", category: "Mental Health", county: "Carson City", city: "Carson City", address: "1665 Old Hot Springs Road, Suite 150, Carson City, NV 89706", phone: "(775) 687-0870", lat: 39.1570, lng: -119.7590 },
  { id: "rs-32", name: "Connections Behavioral Health Center", category: "Mental Health", county: "Carson City", city: "Carson City", address: "77 E William Suite #106, Carson City, NV 89701", phone: "(775) 686-0117", lat: 39.1635, lng: -119.7715 },
  { id: "rs-33", name: "Serenity Mental Health", category: "Mental Health", county: "Carson City", city: "Carson City", address: "755 N Roop Suite #101, Carson City, NV 89701", phone: "(775) 841-6050", lat: 39.1665, lng: -119.7725 },

  // ── Churchill ──
  { id: "rs-34", name: "Churchill County Social Services", category: "Coordinated Entry", county: "Churchill", city: "Fallon", address: "270 S. Maine Street, Suite B, Fallon, NV 89406", phone: "(775) 423-6695", lat: 39.4735, lng: -118.7776 },
  { id: "rs-35", name: "DVI Fallon", category: "Shelter", county: "Churchill", city: "Fallon", address: "37 S. Maine Street, Fallon, NV 89406", phone: "(775) 423-1313", lat: 39.4750, lng: -118.7780 },
  { id: "rs-36", name: "Churchill County Social Services - PATH", category: "Shelter", county: "Churchill", city: "Fallon", address: "270 S. Maine Street, Suite B, Fallon, NV 89406", phone: "(775) 423-6695", lat: 39.4737, lng: -118.7778 },
  { id: "rs-37", name: "Stepping Stones Youth Shelter (FPST)", category: "Shelter", county: "Churchill", city: "Fallon", address: "2101 Agency Road, Fallon, NV 89406", phone: "(775) 423-1132", lat: 39.4680, lng: -118.7830 },
  { id: "rs-38", name: "Churchill County Social Services (RRH)", category: "Supportive Housing", county: "Churchill", city: "Fallon", address: "270 S. Maine Street, Suite B, Fallon, NV 89406", phone: "(775) 423-6695", lat: 39.4733, lng: -118.7774 },
  { id: "rs-39", name: "New Frontier - Room for Ruth (Women)", category: "Recovery/Boarding", county: "Churchill", city: "Fallon", phone: "(775) 423-1412", lat: 39.4760, lng: -118.7790 },
  { id: "rs-40", name: "The Lighthouse at Fallon Christian Fellowship (Men)", category: "Recovery/Boarding", county: "Churchill", city: "Fallon", address: "96 N Broadway, Fallon, NV 89406", phone: "(775) 423-6360", lat: 39.4770, lng: -118.7770 },
  { id: "rs-41", name: "Fallon Daily Bread", category: "Food", county: "Churchill", city: "Fallon", address: "280 E Stillwater Street, Fallon, NV", phone: "(775) 423-4714", lat: 39.4745, lng: -118.7750 },
  { id: "rs-42", name: "New Frontier Food Pantry", category: "Food", county: "Churchill", city: "Fallon", address: "1490 Grimes Street, Fallon, NV 89406", phone: "(775) 442-1686", lat: 39.4710, lng: -118.7810 },
  { id: "rs-43", name: "REAP Soup Kitchen", category: "Food", county: "Churchill", city: "Fallon", address: "985 W. Williams Ave, Fallon, NV 89406", phone: "(775) 420-8304", lat: 39.4755, lng: -118.7830 },
  { id: "rs-44", name: "DCFS Churchill", category: "Family Services", county: "Churchill", city: "Fallon", address: "1735 Kaiser Street, Fallon, NV 89406", phone: "(775) 423-4800", lat: 39.4700, lng: -118.7760 },
  { id: "rs-45", name: "Fallon Youth Club", category: "Family Services", county: "Churchill", city: "Fallon", address: "324 Pennington Circle, Fallon, NV 89406", phone: "(775) 423-6926", lat: 39.4720, lng: -118.7740 },
  { id: "rs-46", name: "William Pennington Life Center", category: "Senior Services", county: "Churchill", city: "Fallon", address: "952 S. Maine Street, Fallon, NV 89406", phone: "(775) 423-7096", lat: 39.4690, lng: -118.7785 },
  { id: "rs-47", name: "EmployNV Business/Career Hub", category: "Employment", county: "Churchill", city: "Fallon", address: "121 Industrial Way, Fallon, NV 89406", phone: "(775) 423-5115", lat: 39.4780, lng: -118.7730 },
  { id: "rs-48", name: "Central Nevada Health District", category: "Physical Health", county: "Churchill", city: "Fallon", address: "485 West B Street, Suite #101, Fallon, NV 89406", lat: 39.4765, lng: -118.7800 },
  { id: "rs-49", name: "Fallon Family Wellness Center", category: "Physical Health", county: "Churchill", city: "Fallon", address: "2040 Reno Highway #400, Fallon, NV 89406", phone: "(775) 423-3392", lat: 39.4790, lng: -118.7720 },
  { id: "rs-50", name: "New Frontier Treatment Center", category: "Substance Use", county: "Churchill", city: "Fallon", address: "1490 Grimes Street, Fallon, NV 89406", phone: "(775) 423-1412", lat: 39.4712, lng: -118.7812 },
  { id: "rs-51", name: "Fallon Family Wellness Center (MH)", category: "Mental Health", county: "Churchill", city: "Fallon", address: "903 Taylor Place, Fallon, NV 89406", phone: "(775) 423-3392", lat: 39.4740, lng: -118.7760 },
  { id: "rs-52", name: "DPBH-Rural Clinics: Fallon", category: "Mental Health", county: "Churchill", city: "Fallon", address: "141 Keddie Street, Fallon, NV 89406", phone: "(775) 687-2297", lat: 39.4728, lng: -118.7795 },

  // ── Douglas ──
  { id: "rs-53", name: "Douglas County Social Services", category: "Coordinated Entry", county: "Douglas", city: "Gardnerville", address: "2300 Meadow Lane, Gardnerville, NV 89410", phone: "(775) 782-9825", lat: 38.9413, lng: -119.7496 },
  { id: "rs-54", name: "Douglas County Social Services (Emergency Housing)", category: "Shelter", county: "Douglas", city: "Gardnerville", address: "1133 Spruce Street, Gardnerville, NV 89410", phone: "(775) 782-9825", lat: 38.9430, lng: -119.7510 },
  { id: "rs-55", name: "Carson Valley Community Food Closet", category: "Food", county: "Douglas", city: "Gardnerville", address: "1255 Waterloo Lane, Gardnerville, NV 89410", phone: "(775) 782-3711", lat: 38.9420, lng: -119.7480 },
  { id: "rs-56", name: "The Outreach Program-Our Lady of Tahoe", category: "Food", county: "Douglas", city: "Zephyr Cove", address: "1 Elks Point Road, Zephyr Cove, NV 89448", phone: "(775) 588-2080", lat: 39.0050, lng: -119.9500 },
  { id: "rs-57", name: "Family Support Council", category: "Family Services", county: "Douglas", city: "Gardnerville", address: "1516 U.S. Highway 395 N, Suite E & F, Gardnerville, NV 89410", phone: "(775) 782-8692", lat: 38.9450, lng: -119.7520 },
  { id: "rs-58", name: "Tahoe Youth & Family Services", category: "Family Services", county: "Douglas", city: "Gardnerville", address: "1512 U.S. Highway 395 N, Suite #3, Gardnerville, NV 89410", phone: "(775) 782-4202", lat: 38.9448, lng: -119.7518 },
  { id: "rs-59", name: "FISH Ranchos Family Services", category: "Family Services", county: "Douglas", city: "Gardnerville", address: "921 Mitch Drive, Gardnerville, NV 89460", phone: "(775) 265-3474", lat: 38.9380, lng: -119.7460 },
  { id: "rs-60", name: "Douglas County Community & Senior Center", category: "Senior Services", county: "Douglas", city: "Gardnerville", address: "1329 Waterloo Lane, Gardnerville, NV 89410", phone: "(775) 782-5500", lat: 38.9440, lng: -119.7490 },
  { id: "rs-61", name: "Carson Valley Health Senior Care", category: "Senior Services", county: "Douglas", city: "Gardnerville", address: "1515 Virginia Ranch Road, Gardnerville, NV 89410", phone: "(775) 783-4823", lat: 38.9460, lng: -119.7530 },
  { id: "rs-62", name: "Douglas County Community Health Nurse", category: "Physical Health", county: "Douglas", city: "Gardnerville", address: "1329 Waterloo Lane, Gardnerville, NV 89410", phone: "(775) 782-9038", lat: 38.9442, lng: -119.7492 },
  { id: "rs-63", name: "Washoe Tribal Health Center", category: "Physical Health", county: "Douglas", city: "Gardnerville", address: "1559 Watasheamu, Gardnerville, NV 89460", phone: "(775) 265-4215", lat: 38.9370, lng: -119.7450 },
  { id: "rs-64", name: "Carson Valley Health Outpatient BH Clinic", category: "Substance Use", county: "Douglas", city: "Gardnerville", address: "1107 US Highway 395 North, Gardnerville, NV 89410", phone: "(775) 782-1630", lat: 38.9455, lng: -119.7500 },
  { id: "rs-65", name: "DPBH-Rural Clinics: Douglas", category: "Mental Health", county: "Douglas", city: "Gardnerville", address: "1528 Highway 395, Ste. 100, Gardnerville, NV 89410", phone: "(775) 687-2160", lat: 38.9445, lng: -119.7515 },
  { id: "rs-66", name: "Community Counseling Center Douglas", category: "Mental Health", county: "Douglas", city: "Gardnerville", address: "1482 US Highway 395 South, Gardnerville, NV 89410", phone: "(775) 882-3945", lat: 38.9395, lng: -119.7475 },

  // ── Elko ──
  { id: "rs-67", name: "Elko FISH", category: "Coordinated Entry", county: "Elko", city: "Elko", address: "821 Water Street, Elko, NV 89801", phone: "(775) 782-9825", lat: 40.8324, lng: -115.7631 },
  { id: "rs-68", name: "Elko FISH Emergency Shelter", category: "Shelter", county: "Elko", city: "Elko", address: "821 Water Street, Elko, NV 89801", phone: "(775) 738-3038", lat: 40.8326, lng: -115.7633 },
  { id: "rs-69", name: "Vitality Unlimited - High Desert Housing", category: "Supportive Housing", county: "Elko", city: "Elko", address: "1250 Lamoille Highway, Suite 943, Elko, NV 89801", phone: "(775) 389-5832", lat: 40.8280, lng: -115.7580 },
  { id: "rs-70", name: "Nevada Legal Services Elko", category: "Legal", county: "Elko", city: "Elko", address: "285 10th Street, Elko, NV 89801", phone: "(775) 753-5880", lat: 40.8340, lng: -115.7650 },
  { id: "rs-71", name: "FISH Food Pantry Elko", category: "Food", county: "Elko", city: "Elko", address: "821 Water Street, Elko, NV 89801", phone: "(775) 738-3038", lat: 40.8328, lng: -115.7635 },
  { id: "rs-72", name: "DCFS Elko", category: "Family Services", county: "Elko", city: "Elko", address: "1010 Ruby Vista Drive, Suite 101, Elko, NV 89801", phone: "(775) 753-1300", lat: 40.8360, lng: -115.7600 },
  { id: "rs-73", name: "Family Resource Center of NE Nevada", category: "Family Services", county: "Elko", city: "Elko", address: "331 Seventh Street, Elko, NV 89801", phone: "(775) 753-7352", lat: 40.8345, lng: -115.7660 },
  { id: "rs-74", name: "Elko Senior Citizen Center", category: "Senior Services", county: "Elko", city: "Elko", address: "1795 Ruby View Drive, Elko, NV 89801", phone: "(775) 738-3030", lat: 40.8300, lng: -115.7550 },
  { id: "rs-75", name: "Employ NV Business/Career Hub Elko", category: "Employment", county: "Elko", city: "Elko", address: "172 6th Street, Elko, NV 89801", phone: "(775) 753-1900", lat: 40.8350, lng: -115.7670 },
  { id: "rs-76", name: "Aging and Disability Services Division Elko", category: "Disability Services", county: "Elko", city: "Elko", address: "1010 Ruby Vista Drive, Suite 104, Elko, NV 89801", phone: "(775) 738-1966", lat: 40.8362, lng: -115.7602 },
  { id: "rs-77", name: "Nevada Health Centers - Elko", category: "Physical Health", county: "Elko", city: "Elko", address: "762 14th Street, Elko, NV 89801", phone: "(775) 738-5850", lat: 40.8310, lng: -115.7620 },
  { id: "rs-78", name: "Elko Community Health Center", category: "Physical Health", county: "Elko", city: "Elko", address: "2098 Idaho Street, Elko, NV 89801", phone: "(775) 389-5778", lat: 40.8290, lng: -115.7640 },
  { id: "rs-79", name: "Wendover Community Health Center", category: "Physical Health", county: "Elko", city: "West Wendover", address: "925 Wells Avenue, West Wendover, NV 89883", phone: "(775) 664-2220", lat: 40.7390, lng: -114.0730 },
  { id: "rs-80", name: "Carlin Community Health Center", category: "Physical Health", county: "Elko", city: "Carlin", address: "310 Memory Lane, Carlin, NV 89822", phone: "(775) 754-2666", lat: 40.7140, lng: -116.1040 },
  { id: "rs-81", name: "Jackpot Community Health Center", category: "Physical Health", county: "Elko", city: "Jackpot", address: "950 Lady Luck Drive, Jackpot, NV 89825", phone: "(775) 755-2500", lat: 41.9830, lng: -114.6740 },
  { id: "rs-82", name: "Ruby Mountain Recovery", category: "Substance Use", county: "Elko", city: "Elko", address: "1009 Silver Street, Elko, NV 89801", phone: "(775) 753-6258", lat: 40.8335, lng: -115.7645 },
  { id: "rs-83", name: "Vitality Unlimited - Vitality Center", category: "Substance Use", county: "Elko", city: "Elko", address: "3740 Idaho Street, Elko, NV 89801", phone: "(775) 738-8004", lat: 40.8250, lng: -115.7700 },
  { id: "rs-84", name: "Vitality Integrated Programs (VIP)", category: "Mental Health", county: "Elko", city: "Elko", address: "215 Bluffs Avenue, Suites 100-200, Elko, NV 89801", phone: "(775) 777-8477", lat: 40.8270, lng: -115.7560 },
  { id: "rs-85", name: "DPBH-Rural Clinics: Elko", category: "Mental Health", county: "Elko", city: "Elko", address: "1825 Pinion Road, Suite A, Elko, NV 89801", phone: "(775) 738-8021", lat: 40.8295, lng: -115.7590 },

  // ── Esmeralda ──
  { id: "rs-86", name: "Nevada Outreach Training Organization", category: "Coordinated Entry", county: "Esmeralda", city: "Goldfield", phone: "(775) 751-1118", lat: 37.7085, lng: -117.2354 },
  { id: "rs-87", name: "Consolidated Agencies of Human Services", category: "Family Services", county: "Esmeralda", city: "Hawthorne", address: "924 5th Street, Hawthorne, NV 89415", phone: "(775) 945-2471", lat: 37.7100, lng: -117.2340, notes: "Serves Esmeralda from Hawthorne" },

  // ── Eureka ──
  { id: "rs-88", name: "Churchill County Social Services (serves Eureka)", category: "Coordinated Entry", county: "Eureka", city: "Eureka", phone: "(775) 423-1412", lat: 39.5127, lng: -115.9605 },
  { id: "rs-89", name: "Food Pantry by Eureka Senior Center", category: "Food", county: "Eureka", city: "Eureka", address: "20 Gold Street, Eureka, NV 89316", phone: "(775) 237-5597", lat: 39.5130, lng: -115.9610 },
  { id: "rs-90", name: "White Pine County Social Services (serves Eureka)", category: "Family Services", county: "Eureka", city: "Ely", address: "297 11th Street, Ely, NV 89301", phone: "(775) 293-6528", lat: 39.5120, lng: -115.9600 },
  { id: "rs-91", name: "Eureka Senior Citizen Center", category: "Senior Services", county: "Eureka", city: "Eureka", address: "20 W. Gold Street, Eureka, NV 89316", phone: "(775) 237-5597", lat: 39.5132, lng: -115.9612 },
  { id: "rs-92", name: "Eureka County Medical Clinic", category: "Physical Health", county: "Eureka", city: "Eureka", address: "250 S Main Street, Eureka, NV 89316", phone: "(775) 237-5642", lat: 39.5115, lng: -115.9595 },
  { id: "rs-93", name: "Central Nevada Health District Eureka", category: "Physical Health", county: "Eureka", city: "Eureka", address: "351 NV-278, Eureka, NV 89316", phone: "(775) 254-0305", lat: 39.5140, lng: -115.9620 },

  // ── Humboldt ──
  { id: "rs-94", name: "Winnemucca Domestic Violence Services", category: "Shelter", county: "Humboldt", city: "Winnemucca", address: "50 A Melarkey Street, Winnemucca, NV 89445", phone: "(775) 625-1313", lat: 40.9730, lng: -117.7357 },
  { id: "rs-95", name: "Frontier Community Coalition (FCC)", category: "Supportive Housing", county: "Humboldt", city: "Winnemucca", address: "667 Anderson Street, Winnemucca, NV 89445", phone: "(775) 374-5638", lat: 40.9720, lng: -117.7340 },
  { id: "rs-96", name: "Soup Kitchen - Winnemucca United Methodist", category: "Food", county: "Humboldt", city: "Winnemucca", address: "138 West Winnemucca Boulevard, Winnemucca, NV 89445", phone: "(775) 623-2814", lat: 40.9740, lng: -117.7370 },
  { id: "rs-97", name: "St. Paul's Catholic Church Food Pantry", category: "Food", county: "Humboldt", city: "Winnemucca", address: "350 Melarkey Street, Winnemucca, NV 89445", phone: "(775) 623-2928", lat: 40.9735, lng: -117.7365 },
  { id: "rs-98", name: "Food Bank of Winnemucca", category: "Food", county: "Humboldt", city: "Winnemucca", address: "150 S. Bridge Street, Winnemucca, NV 89445", phone: "(775) 625-2223", lat: 40.9725, lng: -117.7350 },
  { id: "rs-99", name: "The Family Support Center", category: "Family Services", county: "Humboldt", city: "Winnemucca", address: "1200 E Winnemucca Boulevard, Winnemucca, NV 89445", phone: "(775) 623-1888", lat: 40.9750, lng: -117.7320 },
  { id: "rs-100", name: "DCFS Humboldt", category: "Family Services", county: "Humboldt", city: "Winnemucca", address: "475 W. Haskell Street, Winnemucca, NV 89445", phone: "(775) 623-6555", lat: 40.9710, lng: -117.7380 },
  { id: "rs-101", name: "Senior Citizens of Humboldt", category: "Senior Services", county: "Humboldt", city: "Winnemucca", address: "1480 Lay Street, Winnemucca, NV 89445", phone: "(775) 623-6211", lat: 40.9715, lng: -117.7330 },
  { id: "rs-102", name: "Elwood Staffing", category: "Employment", county: "Humboldt", city: "Winnemucca", address: "3013 Potato Rd Suite #C, Winnemucca, NV 89445", phone: "(775) 623-2113", lat: 40.9760, lng: -117.7310 },
  { id: "rs-103", name: "EmployNV Business/Career Hub Winnemucca", category: "Employment", county: "Humboldt", city: "Winnemucca", address: "475 W Haskell Street Suite 1, Winnemucca, NV 89445", phone: "(775) 623-6520", lat: 40.9712, lng: -117.7382 },
  { id: "rs-104", name: "Humboldt General Hospital", category: "Physical Health", county: "Humboldt", city: "Winnemucca", address: "118 E Haskell Street, Winnemucca, NV 89445", phone: "(775) 623-5222", lat: 40.9718, lng: -117.7360 },
  { id: "rs-105", name: "Golden Valley Medical Center", category: "Physical Health", county: "Humboldt", city: "Winnemucca", address: "515 W Haskell Street, Winnemucca, NV 89445", phone: "(775) 625-4653", lat: 40.9708, lng: -117.7390 },
  { id: "rs-106", name: "Silver Sage Counseling Services", category: "Substance Use", county: "Humboldt", city: "Winnemucca", address: "530 Melarkey Suite #202, Winnemucca, NV 89445", phone: "(775) 623-3626", lat: 40.9732, lng: -117.7368 },
  { id: "rs-107", name: "Winnemucca Mental Health Center", category: "Mental Health", county: "Humboldt", city: "Winnemucca", address: "3140 Traders Way, Winnemucca, NV 89445", phone: "(775) 623-6580", lat: 40.9770, lng: -117.7300 },
  { id: "rs-108", name: "DPBH-Rural Clinics: Winnemucca", category: "Mental Health", county: "Humboldt", city: "Winnemucca", address: "475 W. Haskell Street, Winnemucca, NV 89445", phone: "(775) 687-2150", lat: 40.9714, lng: -117.7384 },

  // ── Lander ──
  { id: "rs-109", name: "Frontier Community Coalition (Lander)", category: "Supportive Housing", county: "Lander", city: "Battle Mountain", address: "667 Anderson Street, Winnemucca, NV 89445", phone: "(775) 374-5638", lat: 40.6424, lng: -116.9343, notes: "Serves Lander from Winnemucca" },
  { id: "rs-110", name: "Assembly of God Helping Hands", category: "Food", county: "Lander", city: "Battle Mountain", address: "289 Stone Avenue, Battle Mountain, NV 89820", phone: "(775) 635-2162", lat: 40.6430, lng: -116.9350 },
  { id: "rs-111", name: "Battle Mountain Family Resource Center", category: "Food", county: "Lander", city: "Battle Mountain", address: "370 S. Mountain Street, Battle Mountain, NV 89820", phone: "(775) 635-8302", lat: 40.6410, lng: -116.9360 },
  { id: "rs-112", name: "Frontier Community Coalition (Family)", category: "Family Services", county: "Lander", city: "Lovelock", address: "1005 E Broadway Avenue, Lovelock, NV 89419", phone: "(775) 273-2400", lat: 40.6420, lng: -116.9340 },
  { id: "rs-113", name: "Senior Citizen Center Battle Mountain", category: "Senior Services", county: "Lander", city: "Battle Mountain", address: "365 E 4th Street, Battle Mountain, NV 89820", phone: "(775) 635-5311", lat: 40.6435, lng: -116.9330 },
  { id: "rs-114", name: "Lander County Community Health Nurse", category: "Physical Health", county: "Lander", city: "Battle Mountain", address: "825 N 2nd Street, Battle Mountain, NV 89820", phone: "(775) 635-2386", lat: 40.6445, lng: -116.9320 },
  { id: "rs-115", name: "Austin Medical Clinic", category: "Physical Health", county: "Lander", city: "Austin", address: "121 Main Street, Austin, NV 89310", phone: "(775) 964-2222", lat: 39.4930, lng: -117.0680 },
  { id: "rs-116", name: "DPBH-Rural Clinics: Battle Mountain", category: "Mental Health", county: "Lander", city: "Battle Mountain", address: "825 North 2nd Street, Battle Mountain, NV 89820", phone: "(775) 635-5753", lat: 40.6447, lng: -116.9322 },

  // ── Lincoln ──
  { id: "rs-117", name: "Nevada Outreach Training Organization", category: "Coordinated Entry", county: "Lincoln", city: "Pioche", phone: "(775) 751-1118", lat: 37.9296, lng: -114.4524 },
  { id: "rs-118", name: "Emergency Food Assistance - Lincoln County", category: "Food", county: "Lincoln", city: "Pioche", phone: "(775) 962-8084", lat: 37.9300, lng: -114.4530 },
  { id: "rs-119", name: "Lincoln County Community Connection", category: "Food", county: "Lincoln", city: "Caliente", address: "30 Lincoln Street, Caliente, NV 89008", phone: "(775) 726-3325", lat: 37.6147, lng: -114.5119 },
  { id: "rs-120", name: "Alamo Senior Center", category: "Senior Services", county: "Lincoln", city: "Alamo", address: "759 Box Canyon Road, Alamo, NV 89001", phone: "(775) 725-3340", lat: 37.3650, lng: -115.1640 },
  { id: "rs-121", name: "Pioche Senior Center", category: "Senior Services", county: "Lincoln", city: "Pioche", address: "410 Field Street, Pioche, NV 89043", phone: "(775) 962-5378", lat: 37.9290, lng: -114.4520 },
  { id: "rs-122", name: "Caliente Olson Senior Center", category: "Senior Services", county: "Lincoln", city: "Caliente", address: "240 Front Street, Caliente, NV 89008", phone: "(775) 726-3740", lat: 37.6150, lng: -114.5115 },
  { id: "rs-123", name: "EmployNV Career Hub Lincoln County", category: "Employment", county: "Lincoln", city: "Caliente", phone: "(775) 726-3800", lat: 37.6155, lng: -114.5110 },
  { id: "rs-124", name: "Lincoln County Medical Associates - Caliente", category: "Physical Health", county: "Lincoln", city: "Caliente", address: "700 N Spring Street, Caliente, NV 89008", phone: "(775) 726-8051", lat: 37.6160, lng: -114.5105 },
  { id: "rs-125", name: "Lincoln County Medical Associates - Alamo", category: "Physical Health", county: "Lincoln", city: "Alamo", address: "33 Joshua Tree Street, Alamo, NV 89001", phone: "(775) 726-8059", lat: 37.3655, lng: -115.1635 },
  { id: "rs-126", name: "Grover C. Dils Medical Center", category: "Physical Health", county: "Lincoln", city: "Caliente", phone: "(775) 726-3171", lat: 37.6145, lng: -114.5122 },
  { id: "rs-127", name: "DPBH-Rural Clinics: Panaca", category: "Mental Health", county: "Lincoln", city: "Panaca", address: "1005 Main Street, Suite 111, Panaca, NV 89042", phone: "(775) 962-8089", lat: 37.7870, lng: -114.3870 },

  // ── Lyon ──
  { id: "rs-128", name: "Lyon County Human Services", category: "Coordinated Entry", county: "Lyon", city: "Silver Springs", address: "620 Lake Avenue, Silver Springs, NV 89429", phone: "(775) 577-5009", lat: 39.4150, lng: -119.2250 },
  { id: "rs-129", name: "Lyon County Human Services (Emergency Shelter)", category: "Shelter", county: "Lyon", city: "Silver Springs", address: "1075 Pyramid Street, Silver Springs, NV 89429", lat: 39.4155, lng: -119.2255 },
  { id: "rs-130", name: "Lyon County Human Services (RRH)", category: "Supportive Housing", county: "Lyon", city: "Silver Springs", address: "1075 Pyramid Street, Silver Springs, NV 89429", lat: 39.4152, lng: -119.2252 },
  { id: "rs-131", name: "Nevada Legal Services Lyon", category: "Legal", county: "Lyon", city: "Yerington", address: "720 S. Main Street, Suite A, Yerington, NV 89447", phone: "(775) 463-1222", lat: 38.9858, lng: -119.1630 },
  { id: "rs-132", name: "Lyon County CASA", category: "Legal", county: "Lyon", city: "Yerington", address: "31 S Main Street, Yerington, NV 89447", phone: "(775) 344-1411", lat: 38.9855, lng: -119.1635 },
  { id: "rs-133", name: "St. Robert Bellarmine Parish", category: "Food", county: "Lyon", city: "Fernley", address: "625 Desert Shadows Lane, Fernley, NV 89408", phone: "(775) 575-4011", lat: 39.6080, lng: -119.2520 },
  { id: "rs-134", name: "Healthy Communities Coalition - Dayton", category: "Food", county: "Lyon", city: "Dayton", address: "209 Dayton Valley Road, Dayton, NV 89403", phone: "(775) 246-7834", lat: 39.2374, lng: -119.5929 },
  { id: "rs-135", name: "Healthy Communities Coalition - Silver Springs", category: "Food", county: "Lyon", city: "Silver Springs", address: "1290 Lahontan Street, Silver Springs, NV 89429", phone: "(775) 577-9161", lat: 39.4160, lng: -119.2240 },
  { id: "rs-136", name: "Healthy Communities Coalition - Yerington", category: "Food", county: "Lyon", city: "Yerington", address: "502 W. Bridge Street, Yerington, NV 89447", phone: "(775) 350-4597", lat: 38.9862, lng: -119.1640 },
  { id: "rs-137", name: "DCFS Fernley", category: "Family Services", county: "Lyon", city: "Fernley", address: "55 North Center Street #3, Fernley, NV 89408", phone: "(775) 575-1844", lat: 39.6085, lng: -119.2510 },
  { id: "rs-138", name: "DCFS Yerington", category: "Family Services", county: "Lyon", city: "Yerington", address: "205 West Goldfield Avenue, Yerington, NV 89447", phone: "(775) 463-3151", lat: 38.9850, lng: -119.1625 },
  { id: "rs-139", name: "Lyon County Senior Center Fernley", category: "Senior Services", county: "Lyon", city: "Fernley", address: "105 Lois Lane, Fernley, NV 89408", phone: "(775) 575-3370", lat: 39.6090, lng: -119.2500 },
  { id: "rs-140", name: "Lyon County Senior Center Yerington", category: "Senior Services", county: "Lyon", city: "Yerington", address: "117 Tilson Rd, Yerington, NV 89447", phone: "(775) 463-6550", lat: 38.9865, lng: -119.1645 },
  { id: "rs-141", name: "Fernley EmployNV Career Hub", category: "Employment", county: "Lyon", city: "Fernley", address: "1320 W Newlands Dr, Fernley, NV 89408", phone: "(775) 439-3077", lat: 39.6095, lng: -119.2530 },
  { id: "rs-142", name: "Dayton Community Health Nurse", category: "Physical Health", county: "Lyon", city: "Dayton", address: "5 Pinecone Road, Suite 103, Dayton, NV 89403", phone: "(775) 246-6211", lat: 39.2380, lng: -119.5935 },
  { id: "rs-143", name: "South Lyon Medical Center", category: "Physical Health", county: "Lyon", city: "Yerington", address: "213 S Whitacre Street, Yerington, NV 89447", phone: "(775) 463-2301", lat: 38.9845, lng: -119.1620 },
  { id: "rs-144", name: "Banner Health Center Fernley", category: "Physical Health", county: "Lyon", city: "Fernley", address: "1260 Nevada Pacific Boulevard, Fernley, NV 89408", phone: "(775) 575-7171", lat: 39.6075, lng: -119.2540 },
  { id: "rs-145", name: "Rural Nevada Counseling - Dayton", category: "Substance Use", county: "Lyon", city: "Dayton", address: "801 Overland Loop, Suite 201, Dayton, NV 89403", phone: "(775) 241-9285", lat: 39.2385, lng: -119.5940 },
  { id: "rs-146", name: "Rural Nevada Counseling - Yerington", category: "Mental Health", county: "Lyon", city: "Yerington", address: "720 S. Main Street, Suite C, Yerington, NV 89447", phone: "(775) 463-6597", lat: 38.9852, lng: -119.1628 },
  { id: "rs-147", name: "DPBH-Rural Clinics: Dayton", category: "Mental Health", county: "Lyon", city: "Dayton", address: "5 Pinecone Road #103, Dayton, NV 89403", phone: "(775) 461-3769", lat: 39.2378, lng: -119.5932 },
  { id: "rs-148", name: "DPBH-Rural Clinics: Fernley", category: "Mental Health", county: "Lyon", city: "Fernley", address: "415 Highway 95A, Building I, Fernley, NV 89408", phone: "(775) 687-2350", lat: 39.6070, lng: -119.2550 },
  { id: "rs-149", name: "DPBH-Rural Clinics: Yerington", category: "Mental Health", county: "Lyon", city: "Yerington", address: "215 W. Bridge Street, Suite 5, Yerington, NV 89447", phone: "(775) 687-2199", lat: 38.9860, lng: -119.1638 },

  // ── Mineral ──
  { id: "rs-150", name: "Lyon County Human Services (serves Mineral)", category: "Coordinated Entry", county: "Mineral", city: "Hawthorne", phone: "(775) 577-5009", lat: 38.5246, lng: -118.6237 },
  { id: "rs-151", name: "SNAP - Dept of Welfare Mineral", category: "Food", county: "Mineral", city: "Hawthorne", address: "1000 C Street, Hawthorne, NV 89415", phone: "(775) 945-3602", lat: 38.5250, lng: -118.6240 },
  { id: "rs-152", name: "Consolidated Agencies of Human Services (WIC)", category: "Food", county: "Mineral", city: "Hawthorne", address: "924 5th Street, Hawthorne, NV 89415", phone: "(775) 945-2471", lat: 38.5255, lng: -118.6245 },
  { id: "rs-153", name: "Mineral County Youth & Family Services", category: "Family Services", county: "Mineral", city: "Hawthorne", address: "314 W Fifth Street, Hawthorne, NV", phone: "(775) 945-3393", lat: 38.5240, lng: -118.6230 },
  { id: "rs-154", name: "Mineral County Senior Center", category: "Senior Services", county: "Mineral", city: "Hawthorne", address: "975 K Street, Hawthorne, NV 89415", phone: "(775) 945-5519", lat: 38.5260, lng: -118.6250 },
  { id: "rs-155", name: "Dept of Welfare and Support Services", category: "Disability Services", county: "Mineral", city: "Hawthorne", address: "1000 C Street, Hawthorne, NV 89415", phone: "(775) 945-3602", lat: 38.5252, lng: -118.6242 },
  { id: "rs-156", name: "Mineral County Health Nurse", category: "Physical Health", county: "Mineral", city: "Hawthorne", address: "331 1st Street, Hawthorne, NV 89415", phone: "(775) 945-3657", lat: 38.5245, lng: -118.6235 },
  { id: "rs-157", name: "Mt. Grant General Hospital", category: "Physical Health", county: "Mineral", city: "Hawthorne", address: "200 South A Street, Hawthorne, NV 89415", phone: "(775) 945-2461", lat: 38.5235, lng: -118.6225 },

  // ── Nye (from TOC — PDF truncated, adding key services) ──
  { id: "rs-158", name: "Nevada Outreach Training Organization", category: "Coordinated Entry", county: "Nye", city: "Pahrump", phone: "(775) 751-1118", lat: 36.2083, lng: -115.9839 },
  { id: "rs-159", name: "Nye County Social Services", category: "Shelter", county: "Nye", city: "Pahrump", phone: "(775) 751-7075", lat: 36.2090, lng: -115.9850 },
  { id: "rs-160", name: "NyE Communities Coalition", category: "Food", county: "Nye", city: "Pahrump", phone: "(775) 727-9970", lat: 36.2100, lng: -115.9830 },
  { id: "rs-161", name: "DCFS Nye County", category: "Family Services", county: "Nye", city: "Pahrump", phone: "(775) 751-7300", lat: 36.2070, lng: -115.9860 },
  { id: "rs-162", name: "Pahrump Senior Center", category: "Senior Services", county: "Nye", city: "Pahrump", phone: "(775) 727-5008", lat: 36.2060, lng: -115.9820 },
  { id: "rs-163", name: "Nevada Health Centers Pahrump", category: "Physical Health", county: "Nye", city: "Pahrump", address: "1430 E Calvada Blvd, Pahrump, NV", phone: "(775) 751-7500", lat: 36.1943, lng: -115.9664 },
  { id: "rs-164", name: "Desert View Hospital BH Services", category: "Mental Health", county: "Nye", city: "Pahrump", address: "360 S Lola Ln, Pahrump, NV", phone: "(775) 751-7500", lat: 36.2142, lng: -116.0248 },

  // ── Pershing ──
  { id: "rs-165", name: "Frontier Community Coalition (Pershing)", category: "Coordinated Entry", county: "Pershing", city: "Lovelock", address: "1005 E Broadway Avenue, Lovelock, NV 89419", phone: "(775) 273-2400", lat: 40.1793, lng: -118.4734 },
  { id: "rs-166", name: "Frontier Community Coalition (Family)", category: "Family Services", county: "Pershing", city: "Lovelock", address: "1005 E Broadway Avenue, Lovelock, NV 89419", phone: "(775) 273-2400", lat: 40.1795, lng: -118.4736 },
  { id: "rs-167", name: "Pershing County Senior Center", category: "Senior Services", county: "Pershing", city: "Lovelock", phone: "(775) 273-2284", lat: 40.1800, lng: -118.4740 },
  { id: "rs-168", name: "Pershing General Hospital", category: "Physical Health", county: "Pershing", city: "Lovelock", address: "855 6th St, Lovelock, NV 89419", phone: "(775) 273-2621", lat: 40.1790, lng: -118.4730 },

  // ── Storey ──
  { id: "rs-169", name: "Lyon County Human Services (serves Storey)", category: "Coordinated Entry", county: "Storey", city: "Virginia City", phone: "(775) 577-5009", lat: 39.3096, lng: -119.6500 },
  { id: "rs-170", name: "Storey County Human Services", category: "Family Services", county: "Storey", city: "Virginia City", phone: "(775) 847-1140", lat: 39.3100, lng: -119.6505 },
  { id: "rs-171", name: "Storey County Senior Center", category: "Senior Services", county: "Storey", city: "Virginia City", phone: "(775) 847-0956", lat: 39.3105, lng: -119.6510 },

  // ── White Pine ──
  { id: "rs-172", name: "White Pine County Social Services", category: "Coordinated Entry", county: "White Pine", city: "Ely", address: "297 11th Street, Ely, NV 89301", phone: "(775) 293-6528", lat: 39.2472, lng: -114.8886 },
  { id: "rs-173", name: "White Pine County Social Services (Shelter)", category: "Shelter", county: "White Pine", city: "Ely", address: "297 11th Street, Ely, NV 89301", phone: "(775) 293-6528", lat: 39.2475, lng: -114.8890 },
  { id: "rs-174", name: "Nevada Legal Services Ely", category: "Legal", county: "White Pine", city: "Ely", phone: "(775) 289-8522", lat: 39.2480, lng: -114.8895 },
  { id: "rs-175", name: "White Pine Food Pantry", category: "Food", county: "White Pine", city: "Ely", phone: "(775) 289-4091", lat: 39.2465, lng: -114.8880 },
  { id: "rs-176", name: "DCFS White Pine", category: "Family Services", county: "White Pine", city: "Ely", address: "1010 E Aultman St, Ely, NV 89301", phone: "(775) 289-1640", lat: 39.2460, lng: -114.8875 },
  { id: "rs-177", name: "White Pine Senior Center", category: "Senior Services", county: "White Pine", city: "Ely", phone: "(775) 289-3582", lat: 39.2485, lng: -114.8900 },
  { id: "rs-178", name: "William Bee Ririe Hospital", category: "Physical Health", county: "White Pine", city: "Ely", address: "1500 Avenue H, Ely, NV 89301", phone: "(775) 289-3001", lat: 39.2556, lng: -114.8596 },
  { id: "rs-179", name: "Nevada Health Centers Ely", category: "Physical Health", county: "White Pine", city: "Ely", address: "1500 Avenue H, Ely, NV 89301", phone: "(775) 289-8500", lat: 39.2550, lng: -114.8600 },
  { id: "rs-180", name: "DPBH-Rural Clinics: Ely", category: "Mental Health", county: "White Pine", city: "Ely", phone: "(775) 289-1640", lat: 39.2470, lng: -114.8885 },
];

/** Unique counties present in the rural services dataset */
export const ruralServiceCounties = [...new Set(ruralServices.map(s => s.county))].sort();
