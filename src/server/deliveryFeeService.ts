export type DeliveryFeeBreakdown = {
  distance_km: number;
  delivery_fee: number;
  fee_label: string;
};

function roundDistance(value: number) {
  return Number.parseFloat(Math.max(0, value).toFixed(1));
}

export function calculateDeliveryFee(distanceKm: number): DeliveryFeeBreakdown {
  const distance = roundDistance(distanceKm);
  if (distance <= 30) {
    return { distance_km: distance, delivery_fee: 0, fee_label: "0-30 km" };
  }
  if (distance <= 35) {
    return { distance_km: distance, delivery_fee: 20, fee_label: "30-35 km" };
  }
  if (distance <= 45) {
    return { distance_km: distance, delivery_fee: 30, fee_label: "35-45 km" };
  }
  if (distance <= 60) {
    return { distance_km: distance, delivery_fee: 50, fee_label: "45-60 km" };
  }
  if (distance <= 75) {
    return { distance_km: distance, delivery_fee: 60, fee_label: "60-75 km" };
  }
  if (distance <= 90) {
    return { distance_km: distance, delivery_fee: 75, fee_label: "75-90 km" };
  }
  return { distance_km: distance, delivery_fee: 90, fee_label: ">90 km" };
}
