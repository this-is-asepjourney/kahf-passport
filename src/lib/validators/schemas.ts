import * as z from 'zod';

// ---- Auth schemas ----
export const loginSchema = z.object({
  email: z.string().email('Email tidak valid'),
  password: z.string().min(6, 'Password minimal 6 karakter'),
});

export const phoneSchema = z.object({
  phone: z
    .string()
    .regex(/^(\+62|62|0)8[1-9][0-9]{6,10}$/, 'Nomor HP tidak valid'),
});

export const otpSchema = z.object({
  otp: z.string().length(6, 'OTP harus 6 digit').regex(/^\d+$/, 'OTP hanya angka'),
});

export const registerSchema = z.object({
  fullName: z.string().min(2, 'Nama minimal 2 karakter').max(100),
  phone: z
    .string()
    .regex(/^(\+62|62|0)8[1-9][0-9]{6,10}$/, 'Nomor HP tidak valid'),
  birthDate: z.string().optional(),
  gender: z.enum(['male', 'female']).optional(),
  city: z.string().max(100).optional(),
  consentAgreed: z.boolean().refine(val => val === true, {
    message: 'Anda harus menyetujui kebijakan privasi',
  }),
});

// ---- Purchase schemas ----
export const purchaseItemSchema = z.object({
  productId: z.string().min(1, 'Produk wajib dipilih'),
  qty: z.number().int().positive('Qty harus > 0'),
  unitPrice: z.number().positive('Harga harus > 0'),
});

export const recordPurchaseSchema = z.object({
  invoiceNo: z.string().min(1, 'No. struk wajib diisi').max(100),
  purchasedAt: z.string(), // ISO datetime string
  items: z.array(purchaseItemSchema).min(1, 'Minimal 1 item'),
});

export const voidPurchaseSchema = z.object({
  reason: z.string().min(5, 'Alasan void minimal 5 karakter').max(300),
});

// ---- Customer quick register by BA ----
export const quickRegisterCustomerSchema = z.object({
  fullName: z.string().min(2, 'Nama minimal 2 karakter').max(100),
  phone: z
    .string()
    .regex(/^(\+62|62|0)8[1-9][0-9]{6,10}$/, 'Nomor HP tidak valid'),
  city: z.string().max(100).optional(),
});

// ---- Master data schemas ----
export const productSchema = z.object({
  categoryId: z.string().min(1),
  sku: z.string().min(1).max(50),
  name: z.string().min(1).max(200),
  defaultPrice: z.number().positive(),
  isActive: z.boolean().default(true),
});

export const storeSchema = z.object({
  regionId: z.string().min(1),
  code: z.string().min(1).max(20),
  name: z.string().min(1).max(200),
  city: z.string().min(1).max(100),
  address: z.string().max(500).optional(),
  isActive: z.boolean().default(true),
});

export type LoginFormValues = z.infer<typeof loginSchema>;
export type PhoneFormValues = z.infer<typeof phoneSchema>;
export type OtpFormValues = z.infer<typeof otpSchema>;
export type RegisterFormValues = z.infer<typeof registerSchema>;
export type RecordPurchaseFormValues = z.infer<typeof recordPurchaseSchema>;
export type VoidPurchaseFormValues = z.infer<typeof voidPurchaseSchema>;
export type QuickRegisterCustomerFormValues = z.infer<typeof quickRegisterCustomerSchema>;
export type ProductFormValues = z.infer<typeof productSchema>;
export type StoreFormValues = z.infer<typeof storeSchema>;
