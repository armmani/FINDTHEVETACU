export type Role = 'owner' | 'vet' | 'admin'

export type AppointmentStatus = 'open' | 'accepted' | 'completed' | 'cancelled'
export type BookingStatus = 'pending_payment' | 'confirmed' | 'awaiting_confirmation' | 'completed' | 'cancelled'

export interface Profile {
  id: string
  role: Role
  full_name: string
  phone: string | null
  avatar_url: string | null
  created_at: string
}

export interface Pet {
  id: string
  owner_id: string
  name: string
  type: string
  age: string
  note: string | null
  created_at: string
}

export interface VetProfile {
  id: string
  user_id: string
  bio: string | null
  license_number: string | null
  acupuncture_fee: number
  travel_rate: number
  location_lat: number | null
  location_lng: number | null
  location_name: string | null
  is_available: boolean
  updated_at: string
  profiles?: Profile
}

export interface Appointment {
  id: string
  owner_id: string
  pet_id: string | null
  pet_name: string
  pet_type: string
  pet_age: string
  symptoms: string
  had_acupuncture_before: boolean
  session_number: number
  preferred_datetime: string
  location_lat: number
  location_lng: number
  location_address: string
  status: AppointmentStatus
  created_at: string
  profiles?: Profile
  pets?: Pet
  bookings?: Booking[]
}

export interface Booking {
  id: string
  appointment_id: string
  vet_id: string
  acupuncture_fee: number
  travel_fee: number
  distance_km: number
  total_fee: number
  deposit_amount: number
  deposit_paid: boolean
  deposit_paid_at: string | null
  status: BookingStatus
  cancelled_by: 'owner' | 'vet' | null
  cancelled_at: string | null
  platform_fee: number
  vet_payout: number | null
  remaining_paid: boolean
  remaining_paid_at: string | null
  created_at: string
  profiles?: Profile
  vet_profiles?: VetProfile
  appointments?: Appointment
}
