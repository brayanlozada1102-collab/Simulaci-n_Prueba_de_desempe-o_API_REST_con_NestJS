export enum UserRole {
  ADMIN = 'admin',
  SUPERVISOR = 'supervisor',
  ADVISOR = 'advisor',
  // Alias for Spanish compatibility
  ASESOR = 'asesor',
}

export class User {
  username: string;
  role: UserRole;
  name: string;
}

export const IN_MEMORY_USERS: Record<string, User> = {
  admin: {
    username: 'admin',
    role: UserRole.ADMIN,
    name: 'Main Administrator',
  },
  supervisor: {
    username: 'supervisor',
    role: UserRole.SUPERVISOR,
    name: 'Commercial Supervisor',
  },
  advisor_john: {
    username: 'advisor_john',
    role: UserRole.ADVISOR,
    name: 'John Advisor',
  },
  advisor_mary: {
    username: 'advisor_mary',
    role: UserRole.ADVISOR,
    name: 'Mary Advisor',
  },
  advisor1: {
    username: 'advisor1',
    role: UserRole.ADVISOR,
    name: 'Advisor One',
  },
  advisor2: {
    username: 'advisor2',
    role: UserRole.ADVISOR,
    name: 'Advisor Two',
  },
  // Spanish aliases for full backward compatibility
  asesor_juan: {
    username: 'asesor_juan',
    role: UserRole.ADVISOR,
    name: 'Juan Asesor',
  },
  asesor_maria: {
    username: 'asesor_maria',
    role: UserRole.ADVISOR,
    name: 'Maria Asesora',
  },
  asesor1: {
    username: 'asesor1',
    role: UserRole.ADVISOR,
    name: 'Asesor Uno',
  },
  asesor2: {
    username: 'asesor2',
    role: UserRole.ADVISOR,
    name: 'Asesor Dos',
  },
};

// Also export alias if anything imports USUARIOS_EN_MEMORIA
export const USUARIOS_EN_MEMORIA = IN_MEMORY_USERS;
