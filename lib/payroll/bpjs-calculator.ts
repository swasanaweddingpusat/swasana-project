interface BpjsRates {
  bpjsKesCompanyRate: number;
  bpjsKesEmployeeRate: number;
  bpjsKesMaxSalary: number;
  jhtCompanyRate: number;
  jhtEmployeeRate: number;
  jkkRate: number;
  jkmRate: number;
  jpCompanyRate: number;
  jpEmployeeRate: number;
  jpMaxSalary: number;
}

interface BpjsResult {
  bpjsKesCompany: number;
  bpjsKesEmployee: number;
  jhtCompany: number;
  jhtEmployee: number;
  jkkAmount: number;
  jkmAmount: number;
  jpCompany: number;
  jpEmployee: number;
}

export function calculateBpjs(gajiPokok: number, rates: BpjsRates): BpjsResult {
  const kesBase = Math.min(gajiPokok, rates.bpjsKesMaxSalary);
  const jpBase = Math.min(gajiPokok, rates.jpMaxSalary);

  return {
    bpjsKesCompany: Math.round((kesBase * rates.bpjsKesCompanyRate) / 100),
    bpjsKesEmployee: Math.round((kesBase * rates.bpjsKesEmployeeRate) / 100),
    jhtCompany: Math.round((gajiPokok * rates.jhtCompanyRate) / 100),
    jhtEmployee: Math.round((gajiPokok * rates.jhtEmployeeRate) / 100),
    jkkAmount: Math.round((gajiPokok * rates.jkkRate) / 100),
    jkmAmount: Math.round((gajiPokok * rates.jkmRate) / 100),
    jpCompany: Math.round((jpBase * rates.jpCompanyRate) / 100),
    jpEmployee: Math.round((jpBase * rates.jpEmployeeRate) / 100),
  };
}

export type { BpjsRates, BpjsResult };
