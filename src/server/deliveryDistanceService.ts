import { DeliveryDistanceStatus } from "@/src/shared/eventPicPublic";
import {
  estimateDriverDistanceOnly,
  estimateNearestDriverDistanceOnly,
  DriverEventInput,
  listDeliveryDrivers,
  recommendAvailableDriver,
  recommendSpecificAvailableDriver
} from "@/src/server/driverAvailabilityService";
import {
  calculateDeliveryFee,
  DeliveryFeeBreakdown
} from "@/src/server/deliveryFeeService";

export type DeliveryFeeBreakdownType = DeliveryFeeBreakdown;

export type DeliveryAdminEstimate = DeliveryFeeBreakdown & {
  distance_status: DeliveryDistanceStatus;
  availability_status: DeliveryDistanceStatus;
  distance_message: string;
  recommended_driver_id: string;
  recommended_driver_name: string;
  driver_start_address: string;
  travel_time_minutes: number;
  available: boolean;
  available_drivers_count: number;
  unavailable_reasons?: Array<{
    driver_id: string;
    driver_name: string;
    reason: "absence" | "stock_full" | "inactive";
    booth_stock: number;
    booked_booths: number;
    remaining_stock: number;
  }>;
};

function emptyEstimate(
  status: DeliveryDistanceStatus,
  message: string
): DeliveryAdminEstimate {
  return {
    available: false,
    distance_status: status,
    availability_status: status,
    distance_message: message,
    recommended_driver_id: "",
    recommended_driver_name: "",
    driver_start_address: "",
    distance_km: 0,
    travel_time_minutes: 0,
    delivery_fee: 0,
    fee_label: "A confirmer",
    available_drivers_count: 0
  };
}

function toDriverEventInput(eventAddressInput: string, options?: Partial<DriverEventInput>): DriverEventInput {
  return {
    event_date: options?.event_date || "",
    event_start_time: options?.event_start_time || "",
    event_end_time: options?.event_end_time || "",
    delivery_time: options?.delivery_time || "",
    return_date: options?.return_date || "",
    return_time: options?.return_time || "",
    event_address: eventAddressInput,
    booth_quantity: options?.booth_quantity || 1
  };
}

export { listDeliveryDrivers, calculateDeliveryFee };
export { estimateDriverDistanceOnly, estimateNearestDriverDistanceOnly };

export async function estimateNearestDriverForEvent(
  eventAddressInput: string,
  options?: Partial<DriverEventInput>
) {
  const recommendation = await recommendAvailableDriver(
    toDriverEventInput(eventAddressInput, options)
  );

  return {
    available: recommendation.available,
    distance_status: recommendation.status,
    availability_status: recommendation.status,
    distance_message: recommendation.distance_message,
    recommended_driver_id: recommendation.recommended_driver_id,
    recommended_driver_name: recommendation.recommended_driver_name,
    driver_start_address: recommendation.driver_start_address,
    distance_km: recommendation.distance_km,
    travel_time_minutes: recommendation.travel_time_minutes,
    delivery_fee: recommendation.delivery_fee,
    fee_label: recommendation.fee_label,
    available_drivers_count: recommendation.available_drivers_count,
    unavailable_reasons: recommendation.unavailable_reasons
  };
}

export async function estimateSpecificDriverForEvent(
  eventAddressInput: string,
  driverIdInput: string,
  options?: Partial<DriverEventInput>
) {
  const recommendation = await recommendSpecificAvailableDriver(
    toDriverEventInput(eventAddressInput, options),
    driverIdInput
  );

  return {
    available: recommendation.available,
    distance_status: recommendation.status,
    availability_status: recommendation.status,
    distance_message: recommendation.distance_message,
    recommended_driver_id: recommendation.recommended_driver_id,
    recommended_driver_name: recommendation.recommended_driver_name,
    driver_start_address: recommendation.driver_start_address,
    distance_km: recommendation.distance_km,
    travel_time_minutes: recommendation.travel_time_minutes,
    delivery_fee: recommendation.delivery_fee,
    fee_label: recommendation.fee_label,
    available_drivers_count: recommendation.available_drivers_count,
    unavailable_reasons: recommendation.unavailable_reasons
  };
}

export function estimateFeeFromManualDistance(distanceKmInput: number) {
  const fee = calculateDeliveryFee(distanceKmInput);
  return {
    available: true,
    distance_status: "calculated" as const,
    availability_status: "calculated" as const,
    distance_message: "Distance saisie manuellement.",
    recommended_driver_id: "",
    recommended_driver_name: "",
    driver_start_address: "",
    distance_km: fee.distance_km,
    travel_time_minutes: 0,
    delivery_fee: fee.delivery_fee,
    fee_label: fee.fee_label,
    available_drivers_count: 0
  };
}

export function publicDeliveryEstimateView(result: DeliveryAdminEstimate) {
  if (result.distance_status === "calculated") {
    return {
      distance_status: result.distance_status,
      delivery_fee: result.delivery_fee,
      fee_label: result.fee_label,
      message: "Frais de deplacement calcules selon le lieu de l'evenement."
    };
  }

  if (result.distance_status === "no_driver_available") {
    return {
      distance_status: result.distance_status,
      delivery_fee: null,
      fee_label: "A confirmer",
      message: "Disponibilite a confirmer par Event Pic."
    };
  }

  return {
    distance_status: result.distance_status,
    delivery_fee: null,
    fee_label: "A confirmer",
    message: "Frais de deplacement a confirmer."
  };
}

export function fallbackDistanceEstimate(
  status: DeliveryDistanceStatus,
  message: string
) {
  return emptyEstimate(status, message);
}
