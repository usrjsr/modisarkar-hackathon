export const RANKS = {
  COMMAND: {
    DGP: { level: 1, label: "DGP", description: "Director General of Police", hierarchy: "Strategic Oversight" },
    ADGP: { level: 2, label: "ADGP", description: "Additional DGP", hierarchy: "Strategic Oversight" },
    IG: { level: 3, label: "IG", description: "Inspector General", hierarchy: "Strategic Oversight" },
  },
  STRATEGIC: {
    DIG: { level: 4, label: "DIG", description: "Deputy Inspector General", hierarchy: "Strategic Oversight" },
    SP: { level: 5, label: "SP", description: "Superintendent of Police", hierarchy: "Strategic Oversight" },
  },
  ZONE_MANAGER: {
    DSP: { level: 6, label: "DSP", description: "Deputy Superintendent of Police", hierarchy: "Zone Managers" },
    ASP: { level: 7, label: "ASP", description: "Assistant SP", hierarchy: "Zone Managers" },
    Inspector: { level: 8, label: "Inspector", description: "Zone Inspector", hierarchy: "Zone Managers" },
  },
  SECTOR_DUTY: {
    SI: { level: 9, label: "SI", description: "Sub-Inspector", hierarchy: "Sector Duty" },
    ASI: { level: 10, label: "ASI", description: "Assistant Sub-Inspector", hierarchy: "Sector Duty" },
    HeadConstable: { level: 11, label: "HC", description: "Head Constable", hierarchy: "Sector Duty" },
    Constable: { level: 12, label: "Constable", description: "Police Constable", hierarchy: "Sector Duty" },
  },
} as const

export const RANK_LIST = [
  "DGP", "ADGP", "IG", "DIG", "SP",
  "DSP", "ASP", "Inspector", "SI",
  "ASI", "HeadConstable", "Constable"
] as const

export const COMMAND_LEVELS = {
  Strategic: "Strategic Oversight",
  ZoneManager: "Zone Managers",
  SectorDuty: "Sector Duty"
} as const

export const MIN_REST_HOURS = {
  SectorDuty: 8,
  ZoneManager: 12,
  Strategic: 24,
} as const
