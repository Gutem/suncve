// CWE Names - Common CWEs with their descriptions
export const CWE_NAMES: Record<string, string> = {
  'CWE-20': 'Improper Input Validation',
  'CWE-22': 'Path Traversal',
  'CWE-77': 'Command Injection',
  'CWE-78': 'OS Command Injection',
  'CWE-79': 'Cross-site Scripting (XSS)',
  'CWE-89': 'SQL Injection',
  'CWE-94': 'Code Injection',
  'CWE-98': 'Local File Inclusion',
  'CWE-119': 'Buffer Overflow',
  'CWE-120': 'Classic Buffer Overflow',
  'CWE-121': 'Stack-based Buffer Overflow',
  'CWE-122': 'Heap-based Buffer Overflow',
  'CWE-125': 'Out-of-bounds Read',
  'CWE-190': 'Integer Overflow',
  'CWE-200': 'Information Exposure',
  'CWE-209': 'Error Message Info Leak',
  'CWE-264': 'Permissions & Access Control',
  'CWE-269': 'Improper Privilege Management',
  'CWE-276': 'Incorrect Default Permissions',
  'CWE-284': 'Improper Access Control',
  'CWE-287': 'Improper Authentication',
  'CWE-295': 'Improper Certificate Validation',
  'CWE-306': 'Missing Authentication',
  'CWE-311': 'Missing Encryption',
  'CWE-312': 'Cleartext Storage',
  'CWE-319': 'Cleartext Transmission',
  'CWE-326': 'Inadequate Encryption Strength',
  'CWE-327': 'Broken Crypto Algorithm',
  'CWE-352': 'Cross-Site Request Forgery (CSRF)',
  'CWE-362': 'Race Condition',
  'CWE-400': 'Resource Exhaustion',
  'CWE-401': 'Memory Leak',
  'CWE-416': 'Use After Free',
  'CWE-434': 'Unrestricted File Upload',
  'CWE-476': 'NULL Pointer Dereference',
  'CWE-502': 'Deserialization of Untrusted Data',
  'CWE-522': 'Insufficiently Protected Credentials',
  'CWE-532': 'Log File Info Leak',
  'CWE-601': 'Open Redirect',
  'CWE-611': 'XML External Entity (XXE)',
  'CWE-617': 'Reachable Assertion',
  'CWE-668': 'Exposure to Wrong Sphere',
  'CWE-674': 'Uncontrolled Recursion',
  'CWE-704': 'Incorrect Type Conversion',
  'CWE-732': 'Incorrect Permission Assignment',
  'CWE-754': 'Improper Check for Unusual Conditions',
  'CWE-770': 'Allocation without Limits',
  'CWE-776': 'XML Entity Expansion (Billion Laughs)',
  'CWE-787': 'Out-of-bounds Write',
  'CWE-798': 'Hardcoded Credentials',
  'CWE-862': 'Missing Authorization',
  'CWE-863': 'Incorrect Authorization',
  'CWE-908': 'Use of Uninitialized Resource',
  'CWE-909': 'Missing Initialization',
  'CWE-918': 'Server-Side Request Forgery (SSRF)',
  'CWE-922': 'Insecure Storage',
  'CWE-1021': 'Improper Restriction of Rendered UI',
  'CWE-1236': 'Improper Neutralization of Formula Elements'
};

// CWE Categories - Groups of related CWEs
export interface CWECategory {
  id: string;
  name: string;
  nameEn: string;
  namePtBR: string;
  cwes: string[];
  description?: string;
}

export const CWE_CATEGORIES: CWECategory[] = [
  {
    id: 'rce',
    name: 'Remote Code Execution',
    nameEn: 'Remote Code Execution (RCE)',
    namePtBR: 'Execução Remota de Código (RCE)',
    cwes: ['CWE-94', 'CWE-77', 'CWE-78', 'CWE-502', 'CWE-434'],
    description:
      'Vulnerabilities that allow attackers to execute arbitrary code remotely'
  },
  {
    id: 'injection',
    name: 'Injection',
    nameEn: 'Injection Attacks',
    namePtBR: 'Ataques de Injeção',
    cwes: ['CWE-89', 'CWE-77', 'CWE-78', 'CWE-94', 'CWE-611', 'CWE-917', 'CWE-98'],
    description: 'SQL, Command, Code, and other injection vulnerabilities'
  },
  {
    id: 'xss',
    name: 'XSS',
    nameEn: 'Cross-Site Scripting (XSS)',
    namePtBR: 'Cross-Site Scripting (XSS)',
    cwes: [
      'CWE-79',
      'CWE-80',
      'CWE-81',
      'CWE-83',
      'CWE-84',
      'CWE-85',
      'CWE-86',
      'CWE-87'
    ],
    description: 'Cross-site scripting vulnerabilities'
  },
  {
    id: 'memory',
    name: 'Memory Corruption',
    nameEn: 'Memory Corruption',
    namePtBR: 'Corrupção de Memória',
    cwes: [
      'CWE-119',
      'CWE-120',
      'CWE-121',
      'CWE-122',
      'CWE-125',
      'CWE-787',
      'CWE-416',
      'CWE-476',
      'CWE-908',
      'CWE-401'
    ],
    description: 'Buffer overflows, use-after-free, and other memory issues'
  },
  {
    id: 'auth',
    name: 'Authentication',
    nameEn: 'Authentication Issues',
    namePtBR: 'Problemas de Autenticação',
    cwes: [
      'CWE-287',
      'CWE-306',
      'CWE-522',
      'CWE-798',
      'CWE-307',
      'CWE-308',
      'CWE-309'
    ],
    description: 'Authentication bypass and credential issues'
  },
  {
    id: 'authz',
    name: 'Authorization',
    nameEn: 'Authorization Issues',
    namePtBR: 'Problemas de Autorização',
    cwes: [
      'CWE-862',
      'CWE-863',
      'CWE-264',
      'CWE-269',
      'CWE-284',
      'CWE-732',
      'CWE-276'
    ],
    description: 'Missing or incorrect authorization checks'
  },
  {
    id: 'path',
    name: 'Path Traversal',
    nameEn: 'Path Traversal',
    namePtBR: 'Travessia de Diretório',
    cwes: [
      'CWE-22',
      'CWE-23',
      'CWE-24',
      'CWE-25',
      'CWE-26',
      'CWE-27',
      'CWE-36',
      'CWE-37'
    ],
    description: 'Directory traversal and path manipulation'
  },
  {
    id: 'crypto',
    name: 'Cryptography',
    nameEn: 'Cryptographic Issues',
    namePtBR: 'Problemas Criptográficos',
    cwes: [
      'CWE-326',
      'CWE-327',
      'CWE-328',
      'CWE-295',
      'CWE-311',
      'CWE-312',
      'CWE-319',
      'CWE-329',
      'CWE-330'
    ],
    description: 'Weak encryption, broken algorithms, and crypto misuse'
  },
  {
    id: 'info',
    name: 'Information Disclosure',
    nameEn: 'Information Disclosure',
    namePtBR: 'Divulgação de Informações',
    cwes: [
      'CWE-200',
      'CWE-209',
      'CWE-532',
      'CWE-497',
      'CWE-538',
      'CWE-668',
      'CWE-922'
    ],
    description: 'Sensitive data exposure and information leaks'
  },
  {
    id: 'dos',
    name: 'Denial of Service',
    nameEn: 'Denial of Service (DoS)',
    namePtBR: 'Negação de Serviço (DoS)',
    cwes: ['CWE-400', 'CWE-770', 'CWE-674', 'CWE-776', 'CWE-754', 'CWE-835'],
    description: 'Resource exhaustion and service disruption'
  },
  {
    id: 'csrf',
    name: 'CSRF',
    nameEn: 'Cross-Site Request Forgery',
    namePtBR: 'Cross-Site Request Forgery',
    cwes: ['CWE-352'],
    description: 'Cross-site request forgery vulnerabilities'
  },
  {
    id: 'ssrf',
    name: 'SSRF',
    nameEn: 'Server-Side Request Forgery',
    namePtBR: 'Server-Side Request Forgery',
    cwes: ['CWE-918'],
    description: 'Server-side request forgery vulnerabilities'
  },
  {
    id: 'xxe',
    name: 'XXE',
    nameEn: 'XML External Entity',
    namePtBR: 'Entidade Externa XML',
    cwes: ['CWE-611', 'CWE-776'],
    description: 'XML external entity injection'
  },
  {
    id: 'deser',
    name: 'Deserialization',
    nameEn: 'Insecure Deserialization',
    namePtBR: 'Deserialização Insegura',
    cwes: ['CWE-502'],
    description: 'Insecure deserialization vulnerabilities'
  },
  {
    id: 'input',
    name: 'Input Validation',
    nameEn: 'Input Validation',
    namePtBR: 'Validação de Entrada',
    cwes: ['CWE-20', 'CWE-704', 'CWE-190', 'CWE-681'],
    description: 'Improper input validation issues'
  }
];

// Get CWE name with fallback
export function getCWEName(cweId: string): string {
  return CWE_NAMES[cweId] || cweId.replace('CWE-', '');
}

// Get CWE display string (ID + Name)
export function getCWEDisplay(cweId: string): string {
  const name = CWE_NAMES[cweId];
  if (name) {
    return `${cweId}: ${name}`;
  }
  return cweId;
}

// Get all CWEs from a category
export function getCWEsFromCategory(categoryId: string): string[] {
  const category = CWE_CATEGORIES.find((c) => c.id === categoryId);
  return category?.cwes || [];
}

// Get category for a CWE (returns first matching category)
export function getCategoryForCWE(cweId: string): CWECategory | null {
  return CWE_CATEGORIES.find((c) => c.cwes.includes(cweId)) || null;
}
