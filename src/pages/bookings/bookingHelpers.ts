import { pick, pickStr } from '@/lib/helpers';
import type { Rec } from '@/types/common';

/** Booking payloads are free-form in the API reference, so each accessor tries the likely field names. */
export const bookingRef = (b: Rec) => pickStr(b, 'reference', 'booking_reference', 'booking_ref', 'code') ?? pickStr(b, 'id', '_id') ?? '—';
export const bookingStatus = (b: Rec) => pickStr(b, 'status');
export const bookingCustomer = (b: Rec) => pickStr(b, 'customer.full_name', 'customer.name', 'customer_name', 'user.full_name');
export const bookingCustomerEmail = (b: Rec) => pickStr(b, 'customer.email', 'customer_email');
export const bookingCar = (b: Rec) => pickStr(b, 'car.title', 'car.name', 'car_title', 'vehicle.title');
export const bookingPickupAt = (b: Rec) => pick(b, 'pickup.dateTime', 'pickup.date_time', 'pickup_at', 'pickup_date', 'start_at');
export const bookingDropoffAt = (b: Rec) => pick(b, 'dropoff.dateTime', 'dropoff.date_time', 'dropoff_at', 'dropoff_date', 'end_at');
export const pickupPlace = (b: Rec) => pickStr(b, 'pickup.locationName', 'pickup.location_name', 'pickup_location.location_name', 'pickup_location_name');
export const dropoffPlace = (b: Rec) => pickStr(b, 'dropoff.locationName', 'dropoff.location_name', 'dropoff_location.location_name', 'dropoff_location_name');
export const bookingPaymentStatus = (b: Rec) => pickStr(b, 'payment_status', 'payment.status');
export const bookingDriverId = (b: Rec) => pickStr(b, 'driver_id', 'driver.id', 'driver._id');
export const bookingDriverName = (b: Rec) => pickStr(b, 'driver.full_name', 'driver.name', 'driver_name');

/** Statuses the API will not let you assign a driver to. */
export const isClosedBooking = (b: Rec) => ['cancelled', 'completed'].includes(bookingStatus(b) ?? '');
