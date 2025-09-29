export interface IRegisterUser {
  name: string;
  email: string;
  phone: string;
  password: string;
}

export interface IUpdateTenant {
  name?: string;
  email?: string;
  phone?: string;
  password?: string;
}
