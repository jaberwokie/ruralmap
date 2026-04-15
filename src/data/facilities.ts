import type { ServiceOperationalMeta } from '@/types/medicaid';
import type { PsychiatricServiceFields, InpatientServiceFields } from '@/types/service-lines';

export type FacilityType = 'hospital' | 'clinic' | 'tier1';
export type FacilityTier = 'tier1' | 'tier2' | 'tier3' | 'none';
export type AccessType = 'Frontier' | 'Rural' | 'Near-Urban';
export type FacilityClassification = 'hospital' | 'cah' | 'clinic_provider' | 'facility';
export type DataConfidence = 'Verified' | 'Likely Accurate' | 'Unverified';

export interface Facility {
  id: string;
  name: string;
  type: FacilityType;
  classification?: FacilityClassification;
  dataConfidence?: DataConfidence;
  city: string;
  county: string;
  address?: string;
  phone?: string;
  website?: string;
  lat: number;
  lng: number;
  notes?: string;
  tier?: FacilityTier;
  service?: string;
  volume?: number;
  accessType?: AccessType;
  /** Medicaid participation and operational metadata */
  operational?: Partial<ServiceOperationalMeta>;
  /** Psychiatric service-line verification (provider entities) */
  psychiatric?: Partial<PsychiatricServiceFields>;
  /** Inpatient service-line verification (hospital entities) */
  inpatient?: Partial<InpatientServiceFields>;
}

export const defaultFacilities: Facility[] = [
  // ── Hospitals ──────────────────────────────────────────────────
  { id: "h1", name: "Desert View Hospital", type: "hospital", classification: "cah", city: "Pahrump", county: "Nye", address: "360 S Lola Ln", lat: 36.2142, lng: -116.0248, notes: "Primary Nye discharge point", accessType: "Near-Urban",
    inpatient: { inpatient_services_offered: true, inpatient_service_types: ['medical inpatient (general acute)'], inpatient_verification_status: 'verified_via_directory', inpatient_accepting_admissions: 'yes', inpatient_medicaid_status: 'participating', inpatient_referral_pathway: 'ED_required', inpatient_bed_availability_model: 'daily_call_required', inpatient_capacity_notes: 'Rural hospital; capacity variable; confirm via ED', inpatient_population_focus: 'adult', inpatient_access_notes: 'Inpatient available; psychiatric cases may transfer out' } },
  { id: "h2", name: "Banner Churchill Community Hospital", type: "hospital", classification: "cah", city: "Fallon", county: "Churchill", address: "801 E Williams Ave", lat: 39.4762, lng: -118.7662, notes: "Regional hospital", accessType: "Rural",
    inpatient: { inpatient_services_offered: true, inpatient_service_types: ['medical inpatient (general acute)'], inpatient_verification_status: 'verified_via_directory', inpatient_accepting_admissions: 'yes', inpatient_medicaid_status: 'participating', inpatient_referral_pathway: 'ED_required', inpatient_bed_availability_model: 'daily_call_required', inpatient_capacity_notes: 'Rural hospital; capacity variable; confirm via ED', inpatient_population_focus: 'adult', inpatient_access_notes: 'Inpatient available; psychiatric cases may transfer out' } },
  { id: "h3", name: "Carson Tahoe Regional Medical Center", type: "hospital", classification: "hospital", city: "Carson City", county: "Carson City", address: "1600 Medical Pkwy", lat: 39.2011, lng: -119.7841, notes: "Primary Carson hub" },
  { id: "h4", name: "Northeastern Nevada Regional Hospital", type: "hospital", classification: "hospital", city: "Elko", county: "Elko", address: "2001 Errecart Blvd", lat: 40.8230, lng: -115.7314, notes: "True rural hub",
    inpatient: { inpatient_services_offered: true, inpatient_service_types: ['medical inpatient (general acute)', 'ICU'], inpatient_verification_status: 'verified_via_directory', inpatient_accepting_admissions: 'yes', inpatient_medicaid_status: 'participating', inpatient_referral_pathway: 'ED_required', inpatient_bed_availability_model: 'daily_call_required', inpatient_capacity_notes: 'Regional hospital with ICU; psychiatric cases may transfer to Reno/SLC', inpatient_population_focus: 'adult', inpatient_access_notes: 'Full inpatient; psychiatric inpatient not confirmed' } },
  { id: "h5", name: "William Bee Ririe Hospital", type: "hospital", classification: "cah", city: "Ely", county: "White Pine", address: "1500 Avenue H", lat: 39.2556, lng: -114.8596, notes: "Frontier coverage", accessType: "Frontier",
    inpatient: { inpatient_services_offered: true, inpatient_service_types: ['medical inpatient (general acute)'], inpatient_verification_status: 'verified_via_directory', inpatient_accepting_admissions: 'yes', inpatient_medicaid_status: 'participating', inpatient_referral_pathway: 'ED_required', inpatient_bed_availability_model: 'daily_call_required', inpatient_capacity_notes: 'Rural hospital; capacity variable; confirm via ED', inpatient_population_focus: 'adult', inpatient_access_notes: 'Inpatient available; psychiatric cases may transfer out' } },
  { id: "h6", name: "Battle Mountain General Hospital", type: "hospital", classification: "cah", city: "Battle Mountain", county: "Lander", address: "535 S Humboldt St", lat: 40.6399, lng: -116.9407, notes: "Low-density area", accessType: "Frontier",
    inpatient: { inpatient_services_offered: true, inpatient_service_types: ['medical inpatient (general acute)'], inpatient_verification_status: 'verified_via_directory', inpatient_accepting_admissions: 'yes', inpatient_medicaid_status: 'participating', inpatient_referral_pathway: 'ED_required', inpatient_bed_availability_model: 'daily_call_required', inpatient_capacity_notes: 'Rural hospital; capacity variable; confirm via ED', inpatient_population_focus: 'adult', inpatient_access_notes: 'Inpatient available; psychiatric cases may transfer out' } },
  { id: "h7", name: "South Lyon Medical Center", type: "hospital", classification: "cah", city: "Yerington", county: "Lyon", address: "213 S Whitacre St", lat: 38.9841, lng: -119.1674, notes: "Rural access point", accessType: "Rural" },
  { id: "h8", name: "Mount Grant General Hospital", type: "hospital", classification: "cah", city: "Hawthorne", county: "Mineral", address: "200 S A St", lat: 38.5166, lng: -118.6274, notes: "Frontier", accessType: "Frontier",
    inpatient: { inpatient_services_offered: true, inpatient_service_types: ['medical inpatient (general acute)'], inpatient_verification_status: 'verified_via_directory', inpatient_accepting_admissions: 'yes', inpatient_medicaid_status: 'participating', inpatient_referral_pathway: 'ED_required', inpatient_bed_availability_model: 'daily_call_required', inpatient_capacity_notes: 'Rural hospital; capacity variable; confirm via ED', inpatient_population_focus: 'adult', inpatient_access_notes: 'Inpatient available; psychiatric cases may transfer out' } },
  { id: "h9", name: "Humboldt General Hospital", type: "hospital", classification: "cah", city: "Winnemucca", county: "Humboldt", address: "118 E Haskell St", lat: 40.9711, lng: -117.7265, notes: "True rural hub", accessType: "Rural",
    inpatient: { inpatient_services_offered: true, inpatient_service_types: ['medical inpatient (general acute)'], inpatient_verification_status: 'verified_via_directory', inpatient_accepting_admissions: 'yes', inpatient_medicaid_status: 'participating', inpatient_referral_pathway: 'ED_required', inpatient_bed_availability_model: 'daily_call_required', inpatient_capacity_notes: 'Rural hospital; capacity variable; confirm via ED', inpatient_population_focus: 'adult', inpatient_access_notes: 'Inpatient available; psychiatric cases may transfer out' } },
  // Additional NRHP hospitals
  { id: "h10", name: "Grover C. Dils Medical Center", type: "hospital", classification: "cah", city: "Caliente", county: "Lincoln", address: "700 N Spring St", lat: 37.6226, lng: -114.5136, notes: "Frontier coverage", accessType: "Frontier",
    inpatient: { inpatient_services_offered: true, inpatient_service_types: ['medical inpatient (general acute)'], inpatient_verification_status: 'verified_via_directory', inpatient_accepting_admissions: 'yes', inpatient_medicaid_status: 'participating', inpatient_referral_pathway: 'ED_required', inpatient_bed_availability_model: 'daily_call_required', inpatient_capacity_notes: 'Rural hospital; capacity variable; confirm via ED', inpatient_population_focus: 'adult', inpatient_access_notes: 'Inpatient available; psychiatric cases may transfer out' } },
  { id: "h11", name: "Pershing General Hospital", type: "hospital", classification: "cah", city: "Lovelock", county: "Pershing", address: "855 6th St", lat: 40.1762, lng: -118.4818, notes: "Rural access", accessType: "Rural",
    inpatient: { inpatient_services_offered: true, inpatient_service_types: ['medical inpatient (general acute)'], inpatient_verification_status: 'verified_via_directory', inpatient_accepting_admissions: 'yes', inpatient_medicaid_status: 'participating', inpatient_referral_pathway: 'ED_required', inpatient_bed_availability_model: 'daily_call_required', inpatient_capacity_notes: 'Rural hospital; capacity variable; confirm via ED', inpatient_population_focus: 'adult', inpatient_access_notes: 'Inpatient available; psychiatric cases may transfer out' } },
  { id: "h12", name: "Boulder City Hospital", type: "hospital", classification: "cah", city: "Boulder City", county: "Clark", address: "901 Adams Blvd", lat: 35.9674, lng: -114.8427, notes: "Near-urban access", accessType: "Near-Urban" },
  { id: "h13", name: "Mesa View Regional Hospital", type: "hospital", classification: "cah", city: "Mesquite", county: "Clark", address: "1299 Bertha Howe Ave", lat: 36.8098, lng: -114.1161, notes: "Near-urban access", accessType: "Near-Urban" },
  { id: "h14", name: "Carson Valley Health", type: "hospital", classification: "cah", city: "Gardnerville", county: "Douglas", address: "1107 Hwy 395 N", lat: 38.9413, lng: -119.7496, notes: "Near-urban access", accessType: "Near-Urban" },
  { id: "h15", name: "Incline Village Community Hospital", type: "hospital", classification: "cah", city: "Incline Village", county: "Washoe", address: "880 Alder Ave", lat: 39.2516, lng: -119.9541, notes: "Near-urban access", accessType: "Near-Urban" },
  // Nye County hospital — Tonopah
  { id: "h16", name: "Nye Regional Medical Center", type: "hospital", classification: "cah", city: "Tonopah", county: "Nye", address: "825 S Main St", lat: 38.0622, lng: -117.2295, notes: "Frontier coverage; limited beds", accessType: "Frontier",
    inpatient: { inpatient_services_offered: true, inpatient_service_types: ['medical inpatient (general acute)'], inpatient_verification_status: 'verified_via_directory', inpatient_accepting_admissions: 'limited', inpatient_medicaid_status: 'participating', inpatient_referral_pathway: 'ED_required', inpatient_bed_availability_model: 'daily_call_required', inpatient_capacity_notes: 'Very small CAH; limited capacity; psychiatric transfers out', inpatient_population_focus: 'adult', inpatient_access_notes: 'Inpatient available; psychiatric cases transfer to Las Vegas' } },

  // ── Clinics / Providers ────────────────────────────────────────
  { id: "c1", name: "Nevada Health Centers Pahrump", type: "clinic", classification: "clinic_provider", city: "Pahrump", county: "Nye", address: "1430 E Calvada Blvd", lat: 36.19200, lng: -115.98820, notes: "FQHC",
    psychiatric: { psychiatric_services_offered: true, psychiatric_service_types: ['medication management', 'outpatient psychiatry', 'adult psychiatry', 'telepsychiatry'], psychiatric_verification_status: 'verified_via_directory', psychiatric_accepting_new_patients: 'unknown', psychiatric_medicaid_status: 'participating', psychiatric_referral_required: 'unknown', psychiatric_wait_time_days: null, psychiatric_population_focus: 'adult', psychiatric_telepsychiatry_available: 'yes', psychiatric_access_notes: 'Directory-based classification; requires direct verification' } },
  { id: "c2", name: "Nevada Health Centers Carson City", type: "clinic", classification: "clinic_provider", city: "Carson City", county: "Carson City", address: "1802 N Carson St", lat: 39.1757, lng: -119.7670, notes: "FQHC" },
  { id: "c3", name: "Nevada Health Centers Fallon", type: "clinic", classification: "clinic_provider", city: "Fallon", county: "Churchill", address: "490 E Williams Ave", lat: 39.4749, lng: -118.7727, notes: "FQHC",
    psychiatric: { psychiatric_services_offered: true, psychiatric_service_types: ['medication management', 'outpatient psychiatry', 'adult psychiatry', 'telepsychiatry'], psychiatric_verification_status: 'verified_via_directory', psychiatric_accepting_new_patients: 'unknown', psychiatric_medicaid_status: 'participating', psychiatric_referral_required: 'unknown', psychiatric_wait_time_days: null, psychiatric_population_focus: 'adult', psychiatric_telepsychiatry_available: 'yes', psychiatric_access_notes: 'Directory-based classification; requires direct verification' } },
  { id: "c4", name: "Nevada Health Centers Elko", type: "clinic", classification: "clinic_provider", city: "Elko", county: "Elko", address: "762 14th St", lat: 40.8416, lng: -115.7584, notes: "FQHC",
    psychiatric: { psychiatric_services_offered: true, psychiatric_service_types: ['medication management', 'outpatient psychiatry', 'adult psychiatry', 'telepsychiatry'], psychiatric_verification_status: 'verified_via_directory', psychiatric_accepting_new_patients: 'unknown', psychiatric_medicaid_status: 'participating', psychiatric_referral_required: 'unknown', psychiatric_wait_time_days: null, psychiatric_population_focus: 'adult', psychiatric_telepsychiatry_available: 'yes', psychiatric_access_notes: 'Directory-based classification; requires direct verification' } },
  { id: "c5", name: "Nevada Health Centers Ely", type: "clinic", classification: "clinic_provider", city: "Ely", county: "White Pine", address: "1500 Avenue H", lat: 39.2556, lng: -114.8596, notes: "FQHC",
    psychiatric: { psychiatric_services_offered: true, psychiatric_service_types: ['medication management', 'outpatient psychiatry', 'adult psychiatry', 'telepsychiatry'], psychiatric_verification_status: 'verified_via_directory', psychiatric_accepting_new_patients: 'unknown', psychiatric_medicaid_status: 'participating', psychiatric_referral_required: 'unknown', psychiatric_wait_time_days: null, psychiatric_population_focus: 'adult', psychiatric_telepsychiatry_available: 'yes', psychiatric_access_notes: 'Directory-based classification; requires direct verification' } },
  { id: "c6", name: "Community Health Alliance Dayton", type: "clinic", classification: "clinic_provider", city: "Dayton", county: "Lyon", address: "25 Dayton Village Pkwy, Dayton, NV 89403", lat: 39.26891, lng: -119.58090, notes: "Primary care + BH", dataConfidence: "Likely Accurate" },
  { id: "c7", name: "Community Health Alliance Carson", type: "clinic", classification: "clinic_provider", city: "Carson City", county: "Carson City", address: "3325 Research Way, Carson City, NV 89706", lat: 39.1880, lng: -119.7530, notes: "BH + PCP", dataConfidence: "Likely Accurate" },
  { id: "c8", name: "First Med Fallon", type: "clinic", classification: "clinic_provider", city: "Fallon", county: "Churchill", address: "560 E Williams Ave", lat: 39.4768, lng: -118.7690, notes: "Urgent care access",
    psychiatric: { psychiatric_services_offered: false, psychiatric_verification_status: 'not_offered' } },

  // ── New rural BH providers ─────────────────────────────────────
  // Elko County
  { id: "r1", name: "Vitrus Health Elko", type: "clinic", classification: "clinic_provider", city: "Elko", county: "Elko", address: "762 14th St, Elko, NV 89801", lat: 40.8390, lng: -115.7560, service: "BH", notes: "CMHC-equivalent BH clinic", dataConfidence: "Likely Accurate",
    psychiatric: { psychiatric_services_offered: true, psychiatric_service_types: ['medication management', 'outpatient psychiatry', 'adult psychiatry', 'telepsychiatry'], psychiatric_verification_status: 'verified_via_directory', psychiatric_accepting_new_patients: 'unknown', psychiatric_medicaid_status: 'participating', psychiatric_referral_required: 'unknown', psychiatric_wait_time_days: null, psychiatric_population_focus: 'both', psychiatric_telepsychiatry_available: 'yes', psychiatric_access_notes: 'Directory-based classification; requires direct verification' } },
  { id: "r2", name: "New Frontier Treatment Center", type: "clinic", classification: "clinic_provider", city: "Elko", county: "Elko", address: "1180 Lamoille Hwy, Elko, NV 89801", lat: 40.8150, lng: -115.7200, service: "BH", notes: "Substance use + BH", dataConfidence: "Likely Accurate",
    psychiatric: { psychiatric_services_offered: true, psychiatric_service_types: ['medication management', 'MAT / substance use prescribing', 'outpatient psychiatry'], psychiatric_verification_status: 'reported_unverified', psychiatric_accepting_new_patients: 'unknown', psychiatric_medicaid_status: 'unknown', psychiatric_referral_required: 'unknown', psychiatric_wait_time_days: null, psychiatric_population_focus: 'adult', psychiatric_telepsychiatry_available: 'yes', psychiatric_access_notes: 'Directory-based classification; requires direct verification' } },
  { id: "r3", name: "Te-Moak Tribal Health Center", type: "clinic", classification: "clinic_provider", city: "Elko", county: "Elko", address: "525 Sunset St, Elko, NV 89801", lat: 40.8340, lng: -115.7700, service: "BH", notes: "Tribal health with BH component", dataConfidence: "Likely Accurate",
    psychiatric: { psychiatric_services_offered: true, psychiatric_service_types: ['outpatient psychiatry', 'telepsychiatry'], psychiatric_verification_status: 'reported_unverified', psychiatric_accepting_new_patients: 'unknown', psychiatric_medicaid_status: 'unknown', psychiatric_referral_required: 'unknown', psychiatric_wait_time_days: null, psychiatric_population_focus: 'both', psychiatric_telepsychiatry_available: 'yes', psychiatric_access_notes: 'Directory-based classification; requires direct verification' } },

  // Nye County
  { id: "r4", name: "Nye County Mental Health", type: "clinic", classification: "clinic_provider", city: "Tonopah", county: "Nye", address: "641 N Main St, Tonopah, NV 89049", lat: 38.0680, lng: -117.2290, service: "BH", notes: "County BH office", dataConfidence: "Likely Accurate",
    psychiatric: { psychiatric_services_offered: true, psychiatric_service_types: ['outpatient psychiatry', 'medication management', 'adult psychiatry', 'telepsychiatry'], psychiatric_verification_status: 'reported_unverified', psychiatric_accepting_new_patients: 'unknown', psychiatric_medicaid_status: 'unknown', psychiatric_referral_required: 'unknown', psychiatric_wait_time_days: null, psychiatric_population_focus: 'adult', psychiatric_telepsychiatry_available: 'yes', psychiatric_access_notes: 'Directory-based classification; requires direct verification' } },

  // White Pine County
  { id: "r5", name: "Rural Counseling and Support Services", type: "clinic", classification: "clinic_provider", city: "Ely", county: "White Pine", address: "2065 Bobcat Dr, Ely, NV 89301", lat: 39.2470, lng: -114.8650, service: "BH", notes: "Small BH clinic", dataConfidence: "Likely Accurate",
    psychiatric: { psychiatric_services_offered: true, psychiatric_service_types: ['outpatient psychiatry', 'telepsychiatry'], psychiatric_verification_status: 'reported_unverified', psychiatric_accepting_new_patients: 'unknown', psychiatric_medicaid_status: 'unknown', psychiatric_referral_required: 'unknown', psychiatric_wait_time_days: null, psychiatric_population_focus: 'adult', psychiatric_telepsychiatry_available: 'yes', psychiatric_access_notes: 'Directory-based classification; requires direct verification' } },

  // Lander County
  { id: "r6", name: "Nevada Health Centers Battle Mountain", type: "clinic", classification: "clinic_provider", city: "Battle Mountain", county: "Lander", address: "640 S Humboldt St, Battle Mountain, NV 89820", lat: 40.6380, lng: -116.9390, notes: "FQHC site", dataConfidence: "Likely Accurate",
    psychiatric: { psychiatric_services_offered: true, psychiatric_service_types: ['medication management', 'outpatient psychiatry', 'telepsychiatry'], psychiatric_verification_status: 'verified_via_directory', psychiatric_accepting_new_patients: 'unknown', psychiatric_medicaid_status: 'participating', psychiatric_referral_required: 'unknown', psychiatric_wait_time_days: null, psychiatric_population_focus: 'adult', psychiatric_telepsychiatry_available: 'yes', psychiatric_access_notes: 'Directory-based classification; requires direct verification' } },

  // Humboldt County
  { id: "r7", name: "Nevada Health Centers Winnemucca", type: "clinic", classification: "clinic_provider", city: "Winnemucca", county: "Humboldt", address: "3780 Morrisey Way, Winnemucca, NV 89445", lat: 40.9600, lng: -117.7100, notes: "FQHC site", dataConfidence: "Likely Accurate",
    psychiatric: { psychiatric_services_offered: true, psychiatric_service_types: ['medication management', 'outpatient psychiatry', 'adult psychiatry', 'telepsychiatry'], psychiatric_verification_status: 'verified_via_directory', psychiatric_accepting_new_patients: 'unknown', psychiatric_medicaid_status: 'participating', psychiatric_referral_required: 'unknown', psychiatric_wait_time_days: null, psychiatric_population_focus: 'adult', psychiatric_telepsychiatry_available: 'yes', psychiatric_access_notes: 'Directory-based classification; requires direct verification' } },
  { id: "r8", name: "Winnemucca Counseling Center", type: "clinic", classification: "clinic_provider", city: "Winnemucca", county: "Humboldt", address: "55 W 4th St, Winnemucca, NV 89445", lat: 40.9730, lng: -117.7350, service: "BH", notes: "Small BH clinic", dataConfidence: "Likely Accurate",
    psychiatric: { psychiatric_services_offered: true, psychiatric_service_types: ['outpatient psychiatry', 'telepsychiatry'], psychiatric_verification_status: 'reported_unverified', psychiatric_accepting_new_patients: 'unknown', psychiatric_medicaid_status: 'unknown', psychiatric_referral_required: 'unknown', psychiatric_wait_time_days: null, psychiatric_population_focus: 'adult', psychiatric_telepsychiatry_available: 'yes', psychiatric_access_notes: 'Directory-based classification; requires direct verification' } },

  // Pershing County
  { id: "r9", name: "Nevada Health Centers Lovelock", type: "clinic", classification: "clinic_provider", city: "Lovelock", county: "Pershing", address: "845 Cornell Ave, Lovelock, NV 89419", lat: 40.1780, lng: -118.4750, notes: "FQHC site", dataConfidence: "Likely Accurate",
    psychiatric: { psychiatric_services_offered: true, psychiatric_service_types: ['medication management', 'outpatient psychiatry', 'telepsychiatry'], psychiatric_verification_status: 'verified_via_directory', psychiatric_accepting_new_patients: 'unknown', psychiatric_medicaid_status: 'participating', psychiatric_referral_required: 'unknown', psychiatric_wait_time_days: null, psychiatric_population_focus: 'adult', psychiatric_telepsychiatry_available: 'yes', psychiatric_access_notes: 'Directory-based classification; requires direct verification' } },

  // Churchill County
  { id: "r10", name: "New Frontier Fallon", type: "clinic", classification: "clinic_provider", city: "Fallon", county: "Churchill", address: "1685 Schurz Hwy, Fallon, NV 89406", lat: 39.4600, lng: -118.7800, service: "BH", notes: "Substance use + BH outpatient", dataConfidence: "Likely Accurate",
    psychiatric: { psychiatric_services_offered: true, psychiatric_service_types: ['medication management', 'MAT / substance use prescribing', 'outpatient psychiatry'], psychiatric_verification_status: 'reported_unverified', psychiatric_accepting_new_patients: 'unknown', psychiatric_medicaid_status: 'unknown', psychiatric_referral_required: 'unknown', psychiatric_wait_time_days: null, psychiatric_population_focus: 'adult', psychiatric_telepsychiatry_available: 'yes', psychiatric_access_notes: 'Directory-based classification; requires direct verification' } },

  // Lincoln County
  { id: "r11", name: "Lincoln County Community Health Nurse", type: "clinic", classification: "clinic_provider", city: "Pioche", county: "Lincoln", address: "360 Lincoln St, Pioche, NV 89043", lat: 37.9380, lng: -114.4510, notes: "County health; limited BH", dataConfidence: "Likely Accurate",
    psychiatric: { psychiatric_services_offered: true, psychiatric_service_types: ['telepsychiatry'], psychiatric_verification_status: 'reported_unverified', psychiatric_accepting_new_patients: 'unknown', psychiatric_medicaid_status: 'unknown', psychiatric_referral_required: 'unknown', psychiatric_wait_time_days: null, psychiatric_population_focus: 'adult', psychiatric_telepsychiatry_available: 'yes', psychiatric_access_notes: 'Directory-based classification; requires direct verification' } },

  // Esmeralda County
  { id: "r12", name: "Esmeralda County Health Services", type: "clinic", classification: "clinic_provider", city: "Goldfield", county: "Esmeralda", address: "233 Crook Ave, Goldfield, NV 89013", lat: 37.7085, lng: -117.2350, notes: "County health office; primary care only", dataConfidence: "Likely Accurate",
    psychiatric: { psychiatric_services_offered: false, psychiatric_verification_status: 'not_offered', psychiatric_access_notes: 'No psychiatric services available locally; nearest BH in Tonopah' } },

  // Eureka County
  { id: "r13", name: "Eureka County Health Clinic", type: "clinic", classification: "clinic_provider", city: "Eureka", county: "Eureka", address: "101 S Main St, Eureka, NV 89316", lat: 39.5125, lng: -115.9600, notes: "County clinic; primary care only", dataConfidence: "Likely Accurate",
    psychiatric: { psychiatric_services_offered: false, psychiatric_verification_status: 'not_offered', psychiatric_access_notes: 'No psychiatric services available locally; nearest BH in Elko or Battle Mountain' } },

  // Mineral County
  { id: "r14", name: "Walker River Paiute Tribal Health", type: "clinic", classification: "clinic_provider", city: "Schurz", county: "Mineral", address: "1001 Hospital Rd, Schurz, NV 89427", lat: 38.9490, lng: -118.8080, service: "BH", notes: "Tribal health with BH component", dataConfidence: "Likely Accurate",
    psychiatric: { psychiatric_services_offered: true, psychiatric_service_types: ['outpatient psychiatry', 'telepsychiatry'], psychiatric_verification_status: 'reported_unverified', psychiatric_accepting_new_patients: 'unknown', psychiatric_medicaid_status: 'unknown', psychiatric_referral_required: 'unknown', psychiatric_wait_time_days: null, psychiatric_population_focus: 'both', psychiatric_telepsychiatry_available: 'yes', psychiatric_access_notes: 'Directory-based classification; requires direct verification' } },

  // ── High-Utilization Clinic / Providers ────────────────────────
  { id: "t1", name: "Beautiful Mind of Las Vegas LLC", type: "clinic", classification: "clinic_provider", city: "Las Vegas", county: "Clark", address: "4955 S Durango Dr, Ste 214, Las Vegas, NV 89113", lat: 36.1020, lng: -115.2790, service: "BH", volume: 9533, tier: "tier1", dataConfidence: "Verified" },
  { id: "t2", name: "Family Centers of Nevada LLC", type: "clinic", classification: "clinic_provider", city: "Pahrump", county: "Nye", address: "1397 E Calvada Blvd, Pahrump, NV 89048", lat: 36.2080, lng: -115.9840, service: "BH", volume: 3305, tier: "tier1", dataConfidence: "Verified",
    psychiatric: { psychiatric_services_offered: true, psychiatric_service_types: ['medication management', 'outpatient psychiatry', 'child/adolescent psychiatry', 'adult psychiatry'], psychiatric_verification_status: 'verified_via_directory', psychiatric_accepting_new_patients: 'unknown', psychiatric_medicaid_status: 'participating', psychiatric_referral_required: 'unknown', psychiatric_wait_time_days: null, psychiatric_population_focus: 'both', psychiatric_telepsychiatry_available: 'unknown', psychiatric_access_notes: 'Directory-based classification; requires direct verification' } },
  { id: "t3", name: "Carson City Community Counseling Center", type: "clinic", classification: "clinic_provider", city: "Carson City", county: "Carson City", address: "207 S Pratt St, Carson City, NV 89701", lat: 39.1631, lng: -119.7676, service: "BH", volume: 2365, tier: "tier1", dataConfidence: "Verified" },
  { id: "t4", name: "Mindspace, LLC", type: "clinic", classification: "clinic_provider", city: "Henderson", county: "Clark", address: "2850 W Horizon Ridge Pkwy, Ste 200, Henderson, NV 89052", lat: 36.0140, lng: -115.1080, service: "BH", volume: 1765, tier: "tier1", dataConfidence: "Likely Accurate" },
  { id: "t5", name: "Aspire Therapeutic Solutions LLC", type: "clinic", classification: "clinic_provider", city: "Pahrump", county: "Nye", address: "1017 E Basin Ave, Ste 3, Pahrump, NV 89060", lat: 36.2058, lng: -115.9833, service: "BH", volume: 1707, tier: "tier1", dataConfidence: "Verified" },
  { id: "t6", name: "Behavioral Health and Psychotherapy Services, LLC", type: "clinic", classification: "clinic_provider", city: "Las Vegas", county: "Clark", address: "3006 S Maryland Pkwy, Ste 600, Las Vegas, NV 89109", lat: 36.1340, lng: -115.1370, service: "BH", volume: 1415, tier: "tier1", dataConfidence: "Likely Accurate" },
  { id: "t7", name: "Carson Tahoe Physician Clinics", type: "clinic", classification: "clinic_provider", city: "Carson City", county: "Carson City", address: "1600 Medical Pkwy, Carson City, NV 89703", lat: 39.2011, lng: -119.7841, service: "PCP", volume: 1294, tier: "tier1", dataConfidence: "Verified" },
  { id: "t8", name: "State of Nevada", type: "clinic", classification: "clinic_provider", city: "Carson City", county: "Carson City", address: "4126 Technology Way, Carson City, NV 89706", lat: 39.19581, lng: -119.72425, service: "BH", volume: 1276, tier: "tier1", dataConfidence: "Verified" },
  { id: "t9", name: "Always Reach Out Behavioral Health LLC", type: "clinic", classification: "clinic_provider", city: "Las Vegas", county: "Clark", address: "4560 W Sahara Ave, Ste 205, Las Vegas, NV 89102", lat: 36.1440, lng: -115.2050, service: "BH", volume: 1254, tier: "tier1", dataConfidence: "Likely Accurate" },
  { id: "t10", name: "Janell Anderson, LCSW, PLLC", type: "clinic", classification: "clinic_provider", city: "Elko", county: "Elko", address: "1515 7th St, Elko, NV 89801", lat: 40.8380, lng: -115.7630, service: "BH", volume: 1212, tier: "tier1", dataConfidence: "Verified",
    psychiatric: { psychiatric_services_offered: true, psychiatric_service_types: ['outpatient psychiatry', 'telepsychiatry'], psychiatric_verification_status: 'reported_unverified', psychiatric_accepting_new_patients: 'unknown', psychiatric_medicaid_status: 'unknown', psychiatric_referral_required: 'unknown', psychiatric_wait_time_days: null, psychiatric_population_focus: 'adult', psychiatric_telepsychiatry_available: 'yes', psychiatric_access_notes: 'Directory-based classification; requires direct verification' } },
  { id: "t11", name: "Battle Born Counseling Center", type: "clinic", classification: "clinic_provider", city: "Carson City", county: "Carson City", address: "1802 N Carson St, Unit 103, Carson City, NV 89701", lat: 39.1757, lng: -119.7670, service: "BH", volume: 1179, tier: "tier1", dataConfidence: "Verified" },
  { id: "t12", name: "Oasis in the Desert Counseling, LLC", type: "clinic", classification: "clinic_provider", city: "Las Vegas", county: "Clark", address: "7361 Prairie Falcon Rd, Ste 110, Las Vegas, NV 89128", lat: 36.1950, lng: -115.2970, service: "BH", volume: 1131, tier: "tier1", dataConfidence: "Verified" },
  { id: "t13", name: "Dynamic Medical Group LLC", type: "clinic", classification: "clinic_provider", city: "Las Vegas", county: "Clark", address: "2020 Goldring Ave, Ste 401, Las Vegas, NV 89106", lat: 36.1760, lng: -115.1620, service: "PCP", volume: 1096, tier: "tier1", dataConfidence: "Likely Accurate" },
  { id: "t14", name: "Dr. Ronald Pak, PsyD LLC", type: "clinic", classification: "clinic_provider", city: "Pahrump", county: "Nye", address: "311 S Frontage Rd, Ste 106, Pahrump, NV 89048", lat: 36.2100, lng: -115.9920, service: "BH", volume: 1086, tier: "tier1", dataConfidence: "Verified" },
  { id: "t15", name: "Serenity Counseling LLC", type: "clinic", classification: "clinic_provider", city: "Las Vegas", county: "Clark", address: "6879 W Charleston Blvd, Las Vegas, NV 89117", lat: 36.1580, lng: -115.2480, service: "BH", volume: 991, tier: "tier1", dataConfidence: "Verified" },
];

export const FACILITY_CLASSIFICATION_LABELS: Record<FacilityClassification, string> = {
  hospital: 'Hospital',
  cah: 'Critical Access Hospital (CAH)',
  clinic_provider: 'Clinic / Community Provider',
  facility: 'Facility',
};

export const DATA_CONFIDENCE_LABELS: Record<DataConfidence, DataConfidence> = {
  Verified: 'Verified',
  'Likely Accurate': 'Likely Accurate',
  Unverified: 'Unverified',
};

export const getFacilityClassification = (facility: Facility): FacilityClassification =>
  facility.classification ?? (facility.type === 'hospital' ? 'hospital' : 'clinic_provider');

export const getFacilityDataConfidence = (facility: Facility): DataConfidence => {
  if (facility.dataConfidence) return facility.dataConfidence;
  if (!Number.isFinite(facility.lat) || !Number.isFinite(facility.lng) || facility.lat === 0 || facility.lng === 0) return 'Unverified';
  if (getFacilityClassification(facility) === 'facility') return 'Unverified';
  if (facility.address) return 'Verified';
  return 'Likely Accurate';
};

export const isCriticalAccessHospital = (facility: Facility) =>
  getFacilityClassification(facility) === 'cah';

export const isNRHPMember = (facility: Facility) =>
  getFacilityClassification(facility) === 'cah';

export const getFacilityTypeLabel = (facility: Facility) => FACILITY_CLASSIFICATION_LABELS[getFacilityClassification(facility)];

export const auditFacilityConfidence = (facilities: Facility[]) => {
  const missingConfidence = facilities
    .filter((facility) => !facility.dataConfidence)
    .map((facility) => facility.name);

  const counts = facilities.reduce<Record<DataConfidence, number>>((acc, facility) => {
    acc[getFacilityDataConfidence(facility)] += 1;
    return acc;
  }, {
    Verified: 0,
    'Likely Accurate': 0,
    Unverified: 0,
  });

  const unverifiedFacilities = facilities
    .filter((facility) => getFacilityDataConfidence(facility) === 'Unverified')
    .map((facility) => ({
      id: facility.id,
      name: facility.name,
      classification: getFacilityClassification(facility),
      county: facility.county,
    }));

  return {
    total: facilities.length,
    counts,
    missingConfidence,
    unverifiedFacilities,
  };
};

export const auditFacilityClassifications = (facilities: Facility[]) => {
  const duplicateNameMap = new Map<string, Set<FacilityClassification>>();
  const missingClassification = facilities
    .filter((facility) => !facility.classification)
    .map((facility) => facility.name);

  const conflictingTags = facilities
    .filter((facility) => {
      const classification = getFacilityClassification(facility);
      return (facility.type === 'clinic' && (classification === 'cah' || classification === 'hospital'))
        || (facility.type === 'hospital' && classification === 'clinic_provider');
    })
    .map((facility) => facility.name);

  facilities.forEach((facility) => {
    const key = facility.name.trim().toLowerCase();
    const classifications = duplicateNameMap.get(key) ?? new Set<FacilityClassification>();
    classifications.add(getFacilityClassification(facility));
    duplicateNameMap.set(key, classifications);
  });

  const duplicateClassificationConflicts = Array.from(duplicateNameMap.entries())
    .filter(([, classifications]) => classifications.size > 1)
    .map(([name]) => name);

  const counts = facilities.reduce<Record<FacilityClassification, number>>((acc, facility) => {
    const classification = getFacilityClassification(facility);
    acc[classification] += 1;
    return acc;
  }, {
    hospital: 0,
    cah: 0,
    clinic_provider: 0,
    facility: 0,
  });

  return {
    total: facilities.length,
    counts,
    missingClassification,
    conflictingTags,
    duplicateClassificationConflicts,
  };
};
