"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Search } from "lucide-react";

// ─── Country type ────────────────────────────────────────────────
type Country = {
  code: string;
  name: string;
  dial: string;
  flag: string;
  placeholder: string;
};

// ─── All countries (sorted alphabetically by French name) ────────
const COUNTRIES: Country[] = [
  { code: "AF", name: "Afghanistan", dial: "+93", flag: "🇦🇫", placeholder: "70 123 4567" },
  { code: "ZA", name: "Afrique du Sud", dial: "+27", flag: "🇿🇦", placeholder: "71 123 4567" },
  { code: "AL", name: "Albanie", dial: "+355", flag: "🇦🇱", placeholder: "66 123 4567" },
  { code: "DZ", name: "Algérie", dial: "+213", flag: "🇩🇿", placeholder: "551 23 45 67" },
  { code: "DE", name: "Allemagne", dial: "+49", flag: "🇩🇪", placeholder: "151 1234 5678" },
  { code: "AD", name: "Andorre", dial: "+376", flag: "🇦🇩", placeholder: "312 345" },
  { code: "AO", name: "Angola", dial: "+244", flag: "🇦🇴", placeholder: "923 123 456" },
  { code: "AG", name: "Antigua-et-Barbuda", dial: "+1268", flag: "🇦🇬", placeholder: "464 1234" },
  { code: "SA", name: "Arabie saoudite", dial: "+966", flag: "🇸🇦", placeholder: "51 234 5678" },
  { code: "AR", name: "Argentine", dial: "+54", flag: "🇦🇷", placeholder: "11 2345 6789" },
  { code: "AM", name: "Arménie", dial: "+374", flag: "🇦🇲", placeholder: "77 123 456" },
  { code: "AU", name: "Australie", dial: "+61", flag: "🇦🇺", placeholder: "412 345 678" },
  { code: "AT", name: "Autriche", dial: "+43", flag: "🇦🇹", placeholder: "664 123 4567" },
  { code: "AZ", name: "Azerbaïdjan", dial: "+994", flag: "🇦🇿", placeholder: "40 123 45 67" },
  { code: "BS", name: "Bahamas", dial: "+1242", flag: "🇧🇸", placeholder: "359 1234" },
  { code: "BH", name: "Bahreïn", dial: "+973", flag: "🇧🇭", placeholder: "3600 1234" },
  { code: "BD", name: "Bangladesh", dial: "+880", flag: "🇧🇩", placeholder: "1812 345678" },
  { code: "BB", name: "Barbade", dial: "+1246", flag: "🇧🇧", placeholder: "250 1234" },
  { code: "BE", name: "Belgique", dial: "+32", flag: "🇧🇪", placeholder: "470 12 34 56" },
  { code: "BZ", name: "Belize", dial: "+501", flag: "🇧🇿", placeholder: "622 1234" },
  { code: "BJ", name: "Bénin", dial: "+229", flag: "🇧🇯", placeholder: "90 12 34 56" },
  { code: "BT", name: "Bhoutan", dial: "+975", flag: "🇧🇹", placeholder: "17 12 34 56" },
  { code: "BY", name: "Biélorussie", dial: "+375", flag: "🇧🇾", placeholder: "29 491 19 11" },
  { code: "BO", name: "Bolivie", dial: "+591", flag: "🇧🇴", placeholder: "71234567" },
  { code: "BA", name: "Bosnie-Herzégovine", dial: "+387", flag: "🇧🇦", placeholder: "61 123 456" },
  { code: "BW", name: "Botswana", dial: "+267", flag: "🇧🇼", placeholder: "71 123 456" },
  { code: "BR", name: "Brésil", dial: "+55", flag: "🇧🇷", placeholder: "11 96123 4567" },
  { code: "BN", name: "Brunei", dial: "+673", flag: "🇧🇳", placeholder: "712 3456" },
  { code: "BG", name: "Bulgarie", dial: "+359", flag: "🇧🇬", placeholder: "48 123 456" },
  { code: "BF", name: "Burkina Faso", dial: "+226", flag: "🇧🇫", placeholder: "70 12 34 56" },
  { code: "BI", name: "Burundi", dial: "+257", flag: "🇧🇮", placeholder: "79 561 234" },
  { code: "KH", name: "Cambodge", dial: "+855", flag: "🇰🇭", placeholder: "91 234 567" },
  { code: "CM", name: "Cameroun", dial: "+237", flag: "🇨🇲", placeholder: "6 71 23 45 67" },
  { code: "CA", name: "Canada", dial: "+1", flag: "🇨🇦", placeholder: "506 234 5678" },
  { code: "CV", name: "Cap-Vert", dial: "+238", flag: "🇨🇻", placeholder: "991 12 34" },
  { code: "CF", name: "Centrafrique", dial: "+236", flag: "🇨🇫", placeholder: "70 01 23 45" },
  { code: "CL", name: "Chili", dial: "+56", flag: "🇨🇱", placeholder: "9 6123 4567" },
  { code: "CN", name: "Chine", dial: "+86", flag: "🇨🇳", placeholder: "131 2345 6789" },
  { code: "CY", name: "Chypre", dial: "+357", flag: "🇨🇾", placeholder: "96 123456" },
  { code: "CO", name: "Colombie", dial: "+57", flag: "🇨🇴", placeholder: "321 1234567" },
  { code: "KM", name: "Comores", dial: "+269", flag: "🇰🇲", placeholder: "321 23 45" },
  { code: "CG", name: "Congo", dial: "+242", flag: "🇨🇬", placeholder: "06 123 4567" },
  { code: "CD", name: "RD Congo", dial: "+243", flag: "🇨🇩", placeholder: "991 234 567" },
  { code: "KR", name: "Corée du Sud", dial: "+82", flag: "🇰🇷", placeholder: "10 1234 5678" },
  { code: "CR", name: "Costa Rica", dial: "+506", flag: "🇨🇷", placeholder: "8312 3456" },
  { code: "CI", name: "Côte d'Ivoire", dial: "+225", flag: "🇨🇮", placeholder: "01 23 45 67 89" },
  { code: "HR", name: "Croatie", dial: "+385", flag: "🇭🇷", placeholder: "91 234 5678" },
  { code: "CU", name: "Cuba", dial: "+53", flag: "🇨🇺", placeholder: "5 1234567" },
  { code: "DK", name: "Danemark", dial: "+45", flag: "🇩🇰", placeholder: "32 12 34 56" },
  { code: "DJ", name: "Djibouti", dial: "+253", flag: "🇩🇯", placeholder: "77 83 10 01" },
  { code: "DM", name: "Dominique", dial: "+1767", flag: "🇩🇲", placeholder: "225 1234" },
  { code: "EG", name: "Égypte", dial: "+20", flag: "🇪🇬", placeholder: "100 123 4567" },
  { code: "AE", name: "Émirats arabes unis", dial: "+971", flag: "🇦🇪", placeholder: "50 123 4567" },
  { code: "EC", name: "Équateur", dial: "+593", flag: "🇪🇨", placeholder: "99 123 4567" },
  { code: "ER", name: "Érythrée", dial: "+291", flag: "🇪🇷", placeholder: "7 123 456" },
  { code: "ES", name: "Espagne", dial: "+34", flag: "🇪🇸", placeholder: "612 34 56 78" },
  { code: "EE", name: "Estonie", dial: "+372", flag: "🇪🇪", placeholder: "5123 4567" },
  { code: "SZ", name: "Eswatini", dial: "+268", flag: "🇸🇿", placeholder: "7612 3456" },
  { code: "US", name: "États-Unis", dial: "+1", flag: "🇺🇸", placeholder: "201 555 0123" },
  { code: "ET", name: "Éthiopie", dial: "+251", flag: "🇪🇹", placeholder: "91 123 4567" },
  { code: "FJ", name: "Fidji", dial: "+679", flag: "🇫🇯", placeholder: "701 2345" },
  { code: "FI", name: "Finlande", dial: "+358", flag: "🇫🇮", placeholder: "41 2345678" },
  { code: "FR", name: "France", dial: "+33", flag: "🇫🇷", placeholder: "6 12 34 56 78" },
  { code: "GA", name: "Gabon", dial: "+241", flag: "🇬🇦", placeholder: "06 03 12 34" },
  { code: "GM", name: "Gambie", dial: "+220", flag: "🇬🇲", placeholder: "301 2345" },
  { code: "GE", name: "Géorgie", dial: "+995", flag: "🇬🇪", placeholder: "555 12 34 56" },
  { code: "GH", name: "Ghana", dial: "+233", flag: "🇬🇭", placeholder: "23 123 4567" },
  { code: "GR", name: "Grèce", dial: "+30", flag: "🇬🇷", placeholder: "691 234 5678" },
  { code: "GD", name: "Grenade", dial: "+1473", flag: "🇬🇩", placeholder: "403 1234" },
  { code: "GT", name: "Guatemala", dial: "+502", flag: "🇬🇹", placeholder: "5123 4567" },
  { code: "GN", name: "Guinée", dial: "+224", flag: "🇬🇳", placeholder: "601 12 34 56" },
  { code: "GQ", name: "Guinée équatoriale", dial: "+240", flag: "🇬🇶", placeholder: "222 123 456" },
  { code: "GW", name: "Guinée-Bissau", dial: "+245", flag: "🇬🇼", placeholder: "955 012 345" },
  { code: "GY", name: "Guyana", dial: "+592", flag: "🇬🇾", placeholder: "609 1234" },
  { code: "HT", name: "Haïti", dial: "+509", flag: "🇭🇹", placeholder: "34 10 1234" },
  { code: "HN", name: "Honduras", dial: "+504", flag: "🇭🇳", placeholder: "9123 4567" },
  { code: "HU", name: "Hongrie", dial: "+36", flag: "🇭🇺", placeholder: "20 123 4567" },
  { code: "IN", name: "Inde", dial: "+91", flag: "🇮🇳", placeholder: "81234 56789" },
  { code: "ID", name: "Indonésie", dial: "+62", flag: "🇮🇩", placeholder: "812 345 678" },
  { code: "IQ", name: "Irak", dial: "+964", flag: "🇮🇶", placeholder: "791 234 5678" },
  { code: "IR", name: "Iran", dial: "+98", flag: "🇮🇷", placeholder: "912 345 6789" },
  { code: "IE", name: "Irlande", dial: "+353", flag: "🇮🇪", placeholder: "85 012 3456" },
  { code: "IS", name: "Islande", dial: "+354", flag: "🇮🇸", placeholder: "611 1234" },
  { code: "IL", name: "Israël", dial: "+972", flag: "🇮🇱", placeholder: "50 234 5678" },
  { code: "IT", name: "Italie", dial: "+39", flag: "🇮🇹", placeholder: "312 345 6789" },
  { code: "JM", name: "Jamaïque", dial: "+1876", flag: "🇯🇲", placeholder: "210 1234" },
  { code: "JP", name: "Japon", dial: "+81", flag: "🇯🇵", placeholder: "90 1234 5678" },
  { code: "JO", name: "Jordanie", dial: "+962", flag: "🇯🇴", placeholder: "7 9012 3456" },
  { code: "KZ", name: "Kazakhstan", dial: "+7", flag: "🇰🇿", placeholder: "771 000 9998" },
  { code: "KE", name: "Kenya", dial: "+254", flag: "🇰🇪", placeholder: "712 123456" },
  { code: "KG", name: "Kirghizistan", dial: "+996", flag: "🇰🇬", placeholder: "700 123 456" },
  { code: "KW", name: "Koweït", dial: "+965", flag: "🇰🇼", placeholder: "500 12345" },
  { code: "LA", name: "Laos", dial: "+856", flag: "🇱🇦", placeholder: "20 23 123 456" },
  { code: "LS", name: "Lesotho", dial: "+266", flag: "🇱🇸", placeholder: "5012 3456" },
  { code: "LV", name: "Lettonie", dial: "+371", flag: "🇱🇻", placeholder: "21 234 567" },
  { code: "LB", name: "Liban", dial: "+961", flag: "🇱🇧", placeholder: "71 123 456" },
  { code: "LR", name: "Liberia", dial: "+231", flag: "🇱🇷", placeholder: "77 012 3456" },
  { code: "LY", name: "Libye", dial: "+218", flag: "🇱🇾", placeholder: "91 2345678" },
  { code: "LI", name: "Liechtenstein", dial: "+423", flag: "🇱🇮", placeholder: "660 1234" },
  { code: "LT", name: "Lituanie", dial: "+370", flag: "🇱🇹", placeholder: "612 34567" },
  { code: "LU", name: "Luxembourg", dial: "+352", flag: "🇱🇺", placeholder: "621 123 456" },
  { code: "MK", name: "Macédoine du Nord", dial: "+389", flag: "🇲🇰", placeholder: "72 345 678" },
  { code: "MG", name: "Madagascar", dial: "+261", flag: "🇲🇬", placeholder: "32 12 345 67" },
  { code: "MY", name: "Malaisie", dial: "+60", flag: "🇲🇾", placeholder: "12 345 6789" },
  { code: "MW", name: "Malawi", dial: "+265", flag: "🇲🇼", placeholder: "991 23 45 67" },
  { code: "MV", name: "Maldives", dial: "+960", flag: "🇲🇻", placeholder: "771 2345" },
  { code: "ML", name: "Mali", dial: "+223", flag: "🇲🇱", placeholder: "70 12 34 56" },
  { code: "MT", name: "Malte", dial: "+356", flag: "🇲🇹", placeholder: "9696 1234" },
  { code: "MA", name: "Maroc", dial: "+212", flag: "🇲🇦", placeholder: "6 12 34 56 78" },
  { code: "MU", name: "Maurice", dial: "+230", flag: "🇲🇺", placeholder: "5251 2345" },
  { code: "MR", name: "Mauritanie", dial: "+222", flag: "🇲🇷", placeholder: "22 12 34 56" },
  { code: "MX", name: "Mexique", dial: "+52", flag: "🇲🇽", placeholder: "222 123 4567" },
  { code: "MD", name: "Moldavie", dial: "+373", flag: "🇲🇩", placeholder: "621 12 345" },
  { code: "MC", name: "Monaco", dial: "+377", flag: "🇲🇨", placeholder: "6 12 34 56 78" },
  { code: "MN", name: "Mongolie", dial: "+976", flag: "🇲🇳", placeholder: "8812 3456" },
  { code: "ME", name: "Monténégro", dial: "+382", flag: "🇲🇪", placeholder: "67 622 901" },
  { code: "MZ", name: "Mozambique", dial: "+258", flag: "🇲🇿", placeholder: "82 123 4567" },
  { code: "MM", name: "Myanmar", dial: "+95", flag: "🇲🇲", placeholder: "9 212 3456" },
  { code: "NA", name: "Namibie", dial: "+264", flag: "🇳🇦", placeholder: "81 123 4567" },
  { code: "NP", name: "Népal", dial: "+977", flag: "🇳🇵", placeholder: "984 1234567" },
  { code: "NI", name: "Nicaragua", dial: "+505", flag: "🇳🇮", placeholder: "8123 4567" },
  { code: "NE", name: "Niger", dial: "+227", flag: "🇳🇪", placeholder: "93 12 34 56" },
  { code: "NG", name: "Nigeria", dial: "+234", flag: "🇳🇬", placeholder: "802 123 4567" },
  { code: "NO", name: "Norvège", dial: "+47", flag: "🇳🇴", placeholder: "406 12 345" },
  { code: "NZ", name: "Nouvelle-Zélande", dial: "+64", flag: "🇳🇿", placeholder: "21 123 4567" },
  { code: "OM", name: "Oman", dial: "+968", flag: "🇴🇲", placeholder: "9212 3456" },
  { code: "UG", name: "Ouganda", dial: "+256", flag: "🇺🇬", placeholder: "712 345678" },
  { code: "UZ", name: "Ouzbékistan", dial: "+998", flag: "🇺🇿", placeholder: "91 234 56 78" },
  { code: "PK", name: "Pakistan", dial: "+92", flag: "🇵🇰", placeholder: "301 2345678" },
  { code: "PA", name: "Panama", dial: "+507", flag: "🇵🇦", placeholder: "6123 4567" },
  { code: "PG", name: "Papouasie-N.-Guinée", dial: "+675", flag: "🇵🇬", placeholder: "7012 3456" },
  { code: "PY", name: "Paraguay", dial: "+595", flag: "🇵🇾", placeholder: "961 456789" },
  { code: "NL", name: "Pays-Bas", dial: "+31", flag: "🇳🇱", placeholder: "6 12345678" },
  { code: "PE", name: "Pérou", dial: "+51", flag: "🇵🇪", placeholder: "912 345 678" },
  { code: "PH", name: "Philippines", dial: "+63", flag: "🇵🇭", placeholder: "905 123 4567" },
  { code: "PL", name: "Pologne", dial: "+48", flag: "🇵🇱", placeholder: "512 345 678" },
  { code: "PT", name: "Portugal", dial: "+351", flag: "🇵🇹", placeholder: "912 345 678" },
  { code: "QA", name: "Qatar", dial: "+974", flag: "🇶🇦", placeholder: "3312 3456" },
  { code: "DO", name: "Rép. dominicaine", dial: "+1809", flag: "🇩🇴", placeholder: "234 5678" },
  { code: "RO", name: "Roumanie", dial: "+40", flag: "🇷🇴", placeholder: "712 034 567" },
  { code: "GB", name: "Royaume-Uni", dial: "+44", flag: "🇬🇧", placeholder: "7911 123456" },
  { code: "RU", name: "Russie", dial: "+7", flag: "🇷🇺", placeholder: "912 345 67 89" },
  { code: "RW", name: "Rwanda", dial: "+250", flag: "🇷🇼", placeholder: "720 123 456" },
  { code: "KN", name: "Saint-Kitts-et-Nevis", dial: "+1869", flag: "🇰🇳", placeholder: "765 1234" },
  { code: "LC", name: "Sainte-Lucie", dial: "+1758", flag: "🇱🇨", placeholder: "284 5678" },
  { code: "VC", name: "Saint-Vincent", dial: "+1784", flag: "🇻🇨", placeholder: "430 1234" },
  { code: "SV", name: "Salvador", dial: "+503", flag: "🇸🇻", placeholder: "7012 3456" },
  { code: "WS", name: "Samoa", dial: "+685", flag: "🇼🇸", placeholder: "72 12345" },
  { code: "SN", name: "Sénégal", dial: "+221", flag: "🇸🇳", placeholder: "70 123 45 67" },
  { code: "RS", name: "Serbie", dial: "+381", flag: "🇷🇸", placeholder: "60 1234567" },
  { code: "SC", name: "Seychelles", dial: "+248", flag: "🇸🇨", placeholder: "2 510 123" },
  { code: "SL", name: "Sierra Leone", dial: "+232", flag: "🇸🇱", placeholder: "25 123456" },
  { code: "SG", name: "Singapour", dial: "+65", flag: "🇸🇬", placeholder: "8123 4567" },
  { code: "SK", name: "Slovaquie", dial: "+421", flag: "🇸🇰", placeholder: "912 123 456" },
  { code: "SI", name: "Slovénie", dial: "+386", flag: "🇸🇮", placeholder: "31 234 567" },
  { code: "SO", name: "Somalie", dial: "+252", flag: "🇸🇴", placeholder: "90 1234567" },
  { code: "SD", name: "Soudan", dial: "+249", flag: "🇸🇩", placeholder: "91 123 1234" },
  { code: "SS", name: "Soudan du Sud", dial: "+211", flag: "🇸🇸", placeholder: "977 123 456" },
  { code: "LK", name: "Sri Lanka", dial: "+94", flag: "🇱🇰", placeholder: "71 234 5678" },
  { code: "SE", name: "Suède", dial: "+46", flag: "🇸🇪", placeholder: "70 123 45 67" },
  { code: "CH", name: "Suisse", dial: "+41", flag: "🇨🇭", placeholder: "76 123 45 67" },
  { code: "SR", name: "Suriname", dial: "+597", flag: "🇸🇷", placeholder: "741 2345" },
  { code: "TJ", name: "Tadjikistan", dial: "+992", flag: "🇹🇯", placeholder: "917 12 3456" },
  { code: "TZ", name: "Tanzanie", dial: "+255", flag: "🇹🇿", placeholder: "621 234 567" },
  { code: "TD", name: "Tchad", dial: "+235", flag: "🇹🇩", placeholder: "63 12 34 56" },
  { code: "CZ", name: "Tchéquie", dial: "+420", flag: "🇨🇿", placeholder: "601 123 456" },
  { code: "TH", name: "Thaïlande", dial: "+66", flag: "🇹🇭", placeholder: "81 234 5678" },
  { code: "TL", name: "Timor oriental", dial: "+670", flag: "🇹🇱", placeholder: "7721 2345" },
  { code: "TG", name: "Togo", dial: "+228", flag: "🇹🇬", placeholder: "90 12 34 56" },
  { code: "TO", name: "Tonga", dial: "+676", flag: "🇹🇴", placeholder: "771 5123" },
  { code: "TT", name: "Trinité-et-Tobago", dial: "+1868", flag: "🇹🇹", placeholder: "291 1234" },
  { code: "TN", name: "Tunisie", dial: "+216", flag: "🇹🇳", placeholder: "20 123 456" },
  { code: "TM", name: "Turkménistan", dial: "+993", flag: "🇹🇲", placeholder: "66 012345" },
  { code: "TR", name: "Turquie", dial: "+90", flag: "🇹🇷", placeholder: "501 234 56 78" },
  { code: "UA", name: "Ukraine", dial: "+380", flag: "🇺🇦", placeholder: "50 123 4567" },
  { code: "UY", name: "Uruguay", dial: "+598", flag: "🇺🇾", placeholder: "94 231 234" },
  { code: "VU", name: "Vanuatu", dial: "+678", flag: "🇻🇺", placeholder: "591 2345" },
  { code: "VE", name: "Venezuela", dial: "+58", flag: "🇻🇪", placeholder: "412 1234567" },
  { code: "VN", name: "Viêt Nam", dial: "+84", flag: "🇻🇳", placeholder: "91 234 56 78" },
  { code: "YE", name: "Yémen", dial: "+967", flag: "🇾🇪", placeholder: "712 345 678" },
  { code: "ZM", name: "Zambie", dial: "+260", flag: "🇿🇲", placeholder: "95 5123456" },
  { code: "ZW", name: "Zimbabwe", dial: "+263", flag: "🇿🇼", placeholder: "71 234 5678" },
];

type Props = {
  value: string;
  action: (e164: string) => void;
  defaultCountry?: string;
  label?: string;
  hint?: string;
};

export default function PhoneInput({
                                     value,
                                     action,
                                     defaultCountry = "FR",
                                     label,
                                     hint,
                                   }: Props) {
  const [selectedCountry, setSelectedCountry] = useState<Country>(
    () => COUNTRIES.find((c) => c.code === defaultCountry.toUpperCase()) ?? COUNTRIES.find((c) => c.code === "FR")!
  );
  const [localNumber, setLocalNumber] = useState("");
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [highlightIdx, setHighlightIdx] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);

  // Parse initial E.164 value
  useEffect(() => {
    if (!value || localNumber) return;
    const sorted = [...COUNTRIES].sort((a, b) => b.dial.length - a.dial.length);
    for (const c of sorted) {
      if (value.startsWith(c.dial)) {
        setSelectedCountry(c);
        setLocalNumber(value.slice(c.dial.length));
        return;
      }
    }
    setLocalNumber(value.replace(/^\+/, "").replace(/^0/, ""));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync defaultCountry from address
  useEffect(() => {
    const match = COUNTRIES.find((c) => c.code === defaultCountry.toUpperCase());
    if (match && match.code !== selectedCountry.code && !localNumber) {
      setSelectedCountry(match);
    }
  }, [defaultCountry]); // eslint-disable-line react-hooks/exhaustive-deps

  // Emit E.164
  useEffect(() => {
    if (!localNumber.trim()) {
      action("");
      return;
    }
    let cleaned = localNumber.replace(/[\s\-().]/g, "");
    if (cleaned.startsWith("0")) cleaned = cleaned.slice(1);
    action(`${selectedCountry.dial}${cleaned}`);
  }, [localNumber, selectedCountry]); // eslint-disable-line react-hooks/exhaustive-deps

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Focus search on open — skip on mobile to avoid keyboard hiding dropdown
  useEffect(() => {
    if (!open) return;
    const isMobile = window.matchMedia("(max-width: 640px)").matches;
    if (!isMobile) {
      setTimeout(() => searchRef.current?.focus(), 30);
    }
  }, [open]);

  // Reset highlight on search change
  useEffect(() => {
    setHighlightIdx(0);
  }, [search]);

  const filtered = search.trim()
    ? COUNTRIES.filter(
      (c) =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.dial.includes(search) ||
        c.code.toLowerCase().includes(search.toLowerCase())
    )
    : COUNTRIES;

  const selectCountry = (c: Country) => {
    setSelectedCountry(c);
    setOpen(false);
    setSearch("");
    // Focus le champ numéro après sélection
    setTimeout(() => phoneRef.current?.focus(), 30);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIdx((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filtered[highlightIdx]) selectCountry(filtered[highlightIdx]);
    } else if (e.key === "Escape") {
      setOpen(false);
      setSearch("");
    }
  };

  return (
    <div>
      {label && (
        <label className="text-sm font-semibold text-slate-800 dark:text-slate-100">
          {label}
        </label>
      )}

      <div className="mt-2 flex items-stretch rounded-lg border border-slate-200 bg-white transition-shadow focus-within:border-[#FF9900]/80 focus-within:ring-4 focus-within:ring-[#FF9900]/25 dark:border-slate-800 dark:bg-slate-950 dark:focus-within:border-[#FFAE33]/70 dark:focus-within:ring-[#FF9900]/18">

        {/* ── Country selector ── */}
        <div className="relative" ref={containerRef}>
          <button
            type="button"
            onClick={() => setOpen(!open)}
            className="flex h-full min-h-[44px] items-center gap-1.5 rounded-l-lg border-r border-slate-200 bg-slate-50 px-3 text-sm transition-colors active:bg-slate-200 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800 dark:active:bg-slate-700"
          >
            <span className="text-lg leading-none">{selectedCountry.flag}</span>
            <span className="text-slate-600 dark:text-slate-400">{selectedCountry.dial}</span>
            <ChevronDown
              size={14}
              className={`text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
            />
          </button>

          {/* ── Compact autocomplete dropdown ── */}
          {open && (
            <div className="absolute left-0 top-full z-[500] mt-1 w-[calc(100vw-2rem)] min-w-[256px] max-w-[320px] overflow-hidden rounded-xl bg-white shadow-xl sm:w-72 dark:bg-slate-950">
              {/* Inline search */}
              <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2.5 dark:border-slate-800">
                <Search size={14} className="flex-shrink-0 text-slate-400" />
                <input
                  ref={searchRef}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={handleSearchKeyDown}
                  placeholder="Pays, code ou indicatif..."
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  className="w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400 dark:text-white dark:placeholder:text-slate-500"
                />
              </div>

              {/* Results — scrollable, touch-friendly */}
              <div className="max-h-[240px] overflow-auto overscroll-contain">
                {filtered.length > 0 ? (
                  filtered.map((c, idx) => (
                    <button
                      key={`${c.code}-${c.dial}`}
                      type="button"
                      onClick={() => selectCountry(c)}
                      className={[
                        "flex w-full items-center gap-2.5 px-3 py-3 text-left text-sm transition-colors",
                        idx === highlightIdx
                          ? "bg-slate-100 dark:bg-slate-800"
                          : "hover:bg-slate-50 dark:hover:bg-slate-900",
                        c.code === selectedCountry.code && idx !== highlightIdx
                          ? "bg-blue-50/50 dark:bg-blue-950/20"
                          : "",
                      ].join(" ")}
                    >
                      <span className="text-base leading-none">{c.flag}</span>
                      <span className="flex-1 truncate text-slate-900 dark:text-white">{c.name}</span>
                      <span className="text-xs text-slate-400 dark:text-slate-500">{c.dial}</span>
                    </button>
                  ))
                ) : (
                  <p className="px-3 py-3 text-center text-sm text-slate-400">Aucun résultat</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── Phone number ── */}
        <input
          ref={phoneRef}
          type="tel"
          value={localNumber}
          onChange={(e) => {
            const v = e.target.value.replace(/[^\d\s\-().]/g, "");
            setLocalNumber(v);
          }}
          placeholder={selectedCountry.placeholder}
          className="w-full min-h-[44px] bg-transparent px-4 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 dark:text-white dark:placeholder:text-slate-500"
        />
      </div>

      {hint && <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">{hint}</p>}
    </div>
  );
}
