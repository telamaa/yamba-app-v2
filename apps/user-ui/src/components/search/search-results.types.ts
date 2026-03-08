export type ParcelCategory =
  | "clothes"
  | "shoes"
  | "fashion-accessories"
  | "other-accessories"
  | "books"
  | "documents"
  | "small-toys"
  | "phone"
  | "computer"
  | "other-electronics"
  | "checked-bag-23kg"
  | "cabin-bag-12kg";

export type TransportMode = "plane" | "train" | "car";
export type SortOption = "earliest" | "lowestPrice";

export type YambaTripResult = {
  id: string;
  fromCity: string;
  toCity: string;
  travelDate: string;
  departureTime?: string;
  minPrice: number;
  currency?: string;
  transportMode: TransportMode;
  allowedCategories: ParcelCategory[];

  superTripper?: boolean;
  profileVerified?: boolean;
  instantBooking?: boolean;
  verifiedTicket?: boolean;

  travelerFirstName?: string;
  travelerLastName?: string;
  travelerAvatarUrl?: string;
};
