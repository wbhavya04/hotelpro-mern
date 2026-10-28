import bcrypt from 'bcryptjs';
import { env } from '../src/config/env';
import { connectDatabase, disconnectDatabase } from '../src/config/db';
import { User } from '../src/models/User.model';
import { Hotel } from '../src/models/Hotel.model';
import { RoomType } from '../src/models/RoomType.model';
import { PhysicalRoom } from '../src/models/PhysicalRoom.model';
import { DailyInventory } from '../src/models/DailyInventory.model';
import { Booking } from '../src/models/Booking.model';
import { Payment } from '../src/models/Payment.model';
import { Review } from '../src/models/Review.model';
import { StaffAssignment } from '../src/models/StaffAssignment.model';
import { ServiceRequest } from '../src/models/ServiceRequest.model';
import { getStayNightStrings } from '../src/utils/referenceGenerator';

interface CityCatalogSpec {
  city: string;
  state: string;
  phonePrefix: string;
  properties: Array<{
    name: string;
    tagline: string;
    address: string;
    basePrice: number;
    rating: number;
    reviews: number;
    style: 'palace' | 'fort' | 'coastal' | 'grand';
  }>;
}

const CITY_CATALOG_SPECS: CityCatalogSpec[] = [
  {
    city: 'Udaipur',
    state: 'Rajasthan',
    phonePrefix: '+91 294',
    properties: [
      { name: 'Jagmandir Island Khori Haveli', tagline: 'Private island sandstone pavilion overlooking southern Lake Pichola', address: 'Pichola Island Jetty Road', basePrice: 18500, rating: 4.9, reviews: 42, style: 'palace' },
      { name: 'Fateh Prakash Aravalli Bagh', tagline: 'Royal Mewar garden retreat framed by the Aravalli hills', address: 'Sajjangarh Monsoon Road', basePrice: 13200, rating: 4.8, reviews: 31, style: 'palace' },
      { name: 'Bagore Ghats Courtyard Inn', tagline: 'Restored 19th-century lakeside haveli steps from Gangaur Ghat', address: '24 Gangaur Ghat Marg', basePrice: 8900, rating: 4.6, reviews: 54, style: 'fort' },
      { name: 'Badi Lake Sandstone Sanctuary', tagline: 'Secluded minimalist luxury resort above tranquil Badi Lake', address: 'Badi Tiger Hill Road', basePrice: 15800, rating: 4.9, reviews: 19, style: 'palace' }
    ]
  },
  {
    city: 'Maheshwar',
    state: 'Madhya Pradesh',
    phonePrefix: '+91 7283',
    properties: [
      { name: 'Rehwa Ghat Weaver’s Residence', tagline: 'Artisanal riverside quarters beside historic handloom workshops', address: 'Narmada Peshwa Ghat', basePrice: 9400, rating: 4.8, reviews: 27, style: 'fort' },
      { name: 'Holkar Bastion River Lodge', tagline: 'Cliffside sandstone suites overlooking sacred Baneshwar Temple', address: 'Upper Fort Ramparts', basePrice: 11800, rating: 4.7, reviews: 21, style: 'fort' },
      { name: 'Sahastradhara Rapids Retreat', tagline: 'Eco-luxury stone cottages along the basalt rapids of the Narmada', address: 'Sahastradhara River Bend', basePrice: 10500, rating: 4.6, reviews: 16, style: 'coastal' },
      { name: 'Mandu Crest Heritage Pavilion', tagline: 'Vindhya plateau stone manor with panoramic canyon vistas', address: 'Dhar-Maheshwar Heritage Highway', basePrice: 11200, rating: 4.8, reviews: 24, style: 'fort' }
    ]
  },
  {
    city: 'South Goa',
    state: 'Goa',
    phonePrefix: '+91 832',
    properties: [
      { name: 'Quinta de Benaulim Palms', tagline: 'Restored 1840 Indo-Portuguese manor set in three acres of spice gardens', address: '42 Mazilvaddo, Benaulim', basePrice: 12400, rating: 4.8, reviews: 38, style: 'coastal' },
      { name: 'Galgibaga Turtle Cove Villas', tagline: 'Secluded timber-and-laterite beach villas on quiet Galgibaga estuary', address: 'Canacona Coastal Drive', basePrice: 14900, rating: 4.9, reviews: 29, style: 'coastal' },
      { name: 'Betul Lighthouse Cliff Resort', tagline: 'Panoramic Sal River confluence resort with infinity plunge pools', address: 'Betul Fort headland', basePrice: 13600, rating: 4.7, reviews: 33, style: 'coastal' },
      { name: 'Colva Velha Courtyard Suites', tagline: 'Whitewashed Portuguese balcão suites amidst swaying coconut groves', address: 'Igreja Road, Colva', basePrice: 8600, rating: 4.5, reviews: 47, style: 'coastal' }
    ]
  },
  {
    city: 'Kolkata',
    state: 'West Bengal',
    phonePrefix: '+91 33',
    properties: [
      { name: 'Alipore Belvedere Manor', tagline: 'Edwardian garden residence near National Library and Horticultural Gardens', address: '9 Belvedere Road, Alipore', basePrice: 11500, rating: 4.8, reviews: 41, style: 'grand' },
      { name: 'Prinsep Ghat Riverfront Chambers', tagline: ' Palladian river-view suites beside Hooghly promenade', address: 'Strand Bank Road, Fort William', basePrice: 10200, rating: 4.7, reviews: 28, style: 'grand' },
      { name: 'Ballygunge Zamindari Bari', tagline: 'Intimate red-oxide courtyard mansion with Bengali fine dining', address: '14 Dover Lane, Ballygunge', basePrice: 9200, rating: 4.9, reviews: 36, style: 'palace' },
      { name: 'Park Street Sovereign Suites', tagline: 'Art Deco executive hotel in the cultural heart of central Kolkata', address: '71 Park Street', basePrice: 8800, rating: 4.6, reviews: 52, style: 'grand' }
    ]
  },
  {
    city: 'Indore',
    state: 'Madhya Pradesh',
    phonePrefix: '+91 731',
    properties: [
      { name: 'Rajwada Holkar Palace Hotel', tagline: 'Maratha-era timber and stone courtyard hotel near historic Lal Bagh', address: 'Lal Bagh Palace Road', basePrice: 9600, rating: 4.8, reviews: 44, style: 'palace' },
      { name: 'The Vijay Nagar Executive Grand', tagline: 'Contemporary business landmark with rooftop Malwa dining lounge', address: 'Scheme 54, AB Road, Vijay Nagar', basePrice: 7800, rating: 4.7, reviews: 61, style: 'grand' },
      { name: 'Ralamandal Forest Crest Resort', tagline: 'Hilltop sanctuary overlooking Ralamandal wildlife reserve', address: 'Mirjapur Bypass Hill', basePrice: 8900, rating: 4.6, reviews: 25, style: 'coastal' },
      { name: 'Residency Kothi Heritage Club', tagline: 'Colonial 1820 portico residence surrounded by century-old banyans', address: 'Residency Area, Indore', basePrice: 10800, rating: 4.9, reviews: 32, style: 'grand' }
    ]
  },
  {
    city: 'Jaipur',
    state: 'Rajasthan',
    phonePrefix: '+91 141',
    properties: [
      { name: 'Amer Kachhwaha Fort Haveli', tagline: 'Amber sandstone citadel suites with direct views of Maota Lake', address: 'Devisinghpura, Amer Road', basePrice: 16200, rating: 4.9, reviews: 58, style: 'palace' },
      { name: 'Civil Lines Samode Bagh', tagline: 'Verandah polo suites set inside walled mughal charbagh gardens', address: 'Jacob Road, Civil Lines', basePrice: 13800, rating: 4.8, reviews: 39, style: 'palace' },
      { name: 'Johari Bazaar Pink Sandstone Inn', tagline: 'Boutique frescoed haveli in the gem cutters quarter of the Walled City', address: 'Haldion Ka Rasta, Johari Bazaar', basePrice: 8400, rating: 4.6, reviews: 49, style: 'fort' },
      { name: 'Nahargarh Ridge Sunset Pavilion', tagline: 'Aravalli ridge retreat with private heated courtyard pools', address: 'Kanak Vrindavan Valley', basePrice: 14900, rating: 4.8, reviews: 27, style: 'fort' }
    ]
  },
  {
    city: 'Jodhpur',
    state: 'Rajasthan',
    phonePrefix: '+91 291',
    properties: [
      { name: 'Mehrangarh Blue Bastion Haveli', tagline: 'Indigo-washed heritage quarters beneath the towering Mehrangarh ramparts', address: 'Sodagaran Mohalla, Old City', basePrice: 12900, rating: 4.9, reviews: 46, style: 'fort' },
      { name: 'Umaid Rattandeep Sandstone Palace', tagline: 'Art Deco Chittar sandstone hotel across from Circuit House gardens', address: 'High Court Colony Road', basePrice: 17400, rating: 4.9, reviews: 35, style: 'palace' },
      { name: 'Mandore Cenotaph Garden Retreat', tagline: 'Quiet orchard pavilions bordering the royal cenotaphs of Mandore', address: 'Mandore Garden Road', basePrice: 9800, rating: 4.7, reviews: 22, style: 'palace' },
      { name: 'Kaylana Lake Desert Camp & Lodge', tagline: 'Tented sandstone suites overlooking desert sunset waters', address: 'Jaisalmer Bypass Road', basePrice: 11200, rating: 4.6, reviews: 30, style: 'fort' }
    ]
  },
  {
    city: 'Jaisalmer',
    state: 'Rajasthan',
    phonePrefix: '+91 2992',
    properties: [
      { name: 'Sonar Quila Golden Haveli', tagline: 'Honey-carved jali merchant mansion overlooking Trikuta Fort', address: 'Dedansar Road, Jaisalmer', basePrice: 13500, rating: 4.8, reviews: 41, style: 'fort' },
      { name: 'Khuri Thar Dune Serai', tagline: 'Caravanserai stone courtyard with private desert astronomy decks', address: 'Khuri Desert Sanctuary', basePrice: 15900, rating: 4.9, reviews: 28, style: 'palace' },
      { name: 'Gadisar Lake Promenade Inn', tagline: 'Lakeside sandstone arches overlooking historic Tilon Ki Pol gateway', address: 'Gadisar Lake Bank', basePrice: 8200, rating: 4.6, reviews: 37, style: 'fort' },
      { name: 'Bada Bagh Oasis Pavilion', tagline: 'Desert mango orchard retreat beside royal Jaisalmer cenotaphs', address: 'Ramgarh Road, Bada Bagh', basePrice: 11900, rating: 4.7, reviews: 19, style: 'palace' }
    ]
  },
  {
    city: 'Mumbai',
    state: 'Maharashtra',
    phonePrefix: '+91 22',
    properties: [
      { name: 'Apollo Bunder Seaface Grand', tagline: 'Harbor-facing heritage landmark overlooking Gateway of India', address: 'PJ Ramchandani Marg, Colaba', basePrice: 19500, rating: 4.9, reviews: 84, style: 'grand' },
      { name: 'Marine Drive Art Deco Chambers', tagline: '1930s sea-facing promenade suites along the Queen’s Necklace', address: 'Netaji Subhash Chandra Bose Road', basePrice: 15200, rating: 4.8, reviews: 62, style: 'grand' },
      { name: 'Bandra Pali Hill Courtyard Boutique', tagline: 'Leafy Portuguese-bungalow enclave hotel in West Bandra', address: '16th Road, Pali Hill, Bandra', basePrice: 12800, rating: 4.7, reviews: 45, style: 'coastal' },
      { name: 'Worli Sea Link Executive Tower', tagline: 'Skyline business suites overlooking the Arabian Sea and Bandra-Worli bridge', address: 'Dr Annie Besant Road, Worli', basePrice: 14100, rating: 4.8, reviews: 53, style: 'grand' }
    ]
  },
  {
    city: 'New Delhi',
    state: 'Delhi',
    phonePrefix: '+91 11',
    properties: [
      { name: 'Lutyens Amrita Shergill Manor', tagline: 'White-bungalow diplomatic retreat steps from Lodhi Gardens', address: 'Amrita Shergill Marg, Lutyens Delhi', basePrice: 18900, rating: 4.9, reviews: 71, style: 'grand' },
      { name: 'Connaught Colonnade Georgian Inn', tagline: 'Restored 1931 inner-circle heritage hotel with private library club', address: 'B Block, Connaught Place', basePrice: 12600, rating: 4.7, reviews: 59, style: 'grand' },
      { name: 'Mehrauli Qutub Bagh Haveli', tagline: 'Mughal-inspired stone courtyard overlooking Qutub Minar', address: 'Ambawatta One, Mehrauli', basePrice: 14400, rating: 4.8, reviews: 34, style: 'palace' },
      { name: 'Chanakyapuri Embassy Suites', tagline: 'Soundproofed executive residences in New Delhi’s diplomatic enclave', address: 'Nyaya Marg, Chanakyapuri', basePrice: 15800, rating: 4.8, reviews: 42, style: 'grand' }
    ]
  },
  {
    city: 'Bengaluru',
    state: 'Karnataka',
    phonePrefix: '+91 80',
    properties: [
      { name: 'Cubbon Park Verandah Grand', tagline: 'Colonial garden hotel shaded by rain trees in central Bengaluru', address: 'Kasturba Road, Cubbon Park', basePrice: 13400, rating: 4.8, reviews: 67, style: 'grand' },
      { name: 'Lavelle Road Boutique Conservatory', tagline: 'Botanical courtyard hotel with craft roastery and executive boardrooms', address: '22 Lavelle Road', basePrice: 11200, rating: 4.7, reviews: 48, style: 'grand' },
      { name: 'Indiranagar Teakwood Residences', tagline: 'Design-forward loft suites in Bengaluru’s culinary neighborhood', address: '100 Feet Road, Indiranagar', basePrice: 9500, rating: 4.6, reviews: 55, style: 'coastal' },
      { name: 'Nandi Hills Vineyard Sanctuary', tagline: 'Mist-covered hillside villas overlooking boutique wine estates', address: 'Foothills of Nandi, Devanahalli', basePrice: 14800, rating: 4.9, reviews: 31, style: 'coastal' }
    ]
  },
  {
    city: 'Kochi',
    state: 'Kerala',
    phonePrefix: '+91 484',
    properties: [
      { name: 'Fort Kochi Dutch Harbour House', tagline: '17th-century spice merchant warehouse facing the Chinese fishing nets', address: 'Calvathy Road, Fort Kochi', basePrice: 11800, rating: 4.9, reviews: 43, style: 'coastal' },
      { name: 'Mattancherry Jew Town Courtyard', tagline: 'Laterite and Malabar teak heritage hotel beside Paradesi Synagogue', address: 'Bazaar Road, Mattancherry', basePrice: 9900, rating: 4.8, reviews: 37, style: 'coastal' },
      { name: 'Bolgatty Backwater Island Resort', tagline: 'Waterfront marina villas at the confluence of Vembanad Lake', address: 'Mulavukad Island, Kochi', basePrice: 13200, rating: 4.7, reviews: 29, style: 'coastal' },
      { name: 'Willingdon Pier Maritime Grand', tagline: 'Art Deco harbourfront landmark with private sunset motor launch', address: 'Bristow Road, Willingdon Island', basePrice: 12500, rating: 4.8, reviews: 34, style: 'grand' }
    ]
  },
  {
    city: 'Munnar',
    state: 'Kerala',
    phonePrefix: '+91 4865',
    properties: [
      { name: 'Devikulam Tea Planter’s Bungalow', tagline: '1912 Scottish stone planter bungalow amidst high-altitude tea estates', address: 'Chinnakanal Suryanelli Road', basePrice: 12900, rating: 4.9, reviews: 38, style: 'coastal' },
      { name: 'Cardamom Cloud Valley Sanctuary', tagline: 'Glass-walled rainforest cottages overlooking Anamudi peak', address: 'Pothamedu Viewpoint Ridge', basePrice: 11400, rating: 4.8, reviews: 26, style: 'coastal' },
      { name: 'Mattupetty Mist Lake Chalets', tagline: 'Cedar-lined mountain suites above tranquil Mattupetty reservoir', address: 'Top Station Highway', basePrice: 9600, rating: 4.7, reviews: 33, style: 'coastal' },
      { name: 'Kolukkumalai Sunrise Crest Lodge', tagline: 'High-range heritage estate with organic orthodox tea tastings', address: 'Munnar-Bodinayakkanur Ghat Road', basePrice: 13800, rating: 4.9, reviews: 21, style: 'fort' }
    ]
  },
  {
    city: 'Shimla',
    state: 'Himachal Pradesh',
    phonePrefix: '+91 177',
    properties: [
      { name: 'Mashobra Cedar Forest Manor', tagline: 'Himalayan deodar-and-stone Viceregal lodge at 7,700 feet', address: 'Charabra Ridge, Mashobra', basePrice: 16500, rating: 4.9, reviews: 45, style: 'grand' },
      { name: 'Observatory Hill Heritage Grand', tagline: 'Tudor-style mountain hotel overlooking snow-dusted Pir Panjal peaks', address: 'Chaura Maidan, Shimla', basePrice: 12800, rating: 4.8, reviews: 39, style: 'grand' },
      { name: 'Naldehra Golf Glade Chalets', tagline: 'Sunlit pine cottages bordering India’s oldest mountain golf course', address: 'Naldehra Spur Road', basePrice: 10900, rating: 4.7, reviews: 28, style: 'coastal' },
      { name: 'Chail Palace Orchard Retreat', tagline: 'Quiet apple-orchard stone cottages with wood-burning fireplaces', address: 'Kufri-Chail Mountain Road', basePrice: 9800, rating: 4.6, reviews: 31, style: 'fort' }
    ]
  },
  {
    city: 'Rishikesh',
    state: 'Uttarakhand',
    phonePrefix: '+91 135',
    properties: [
      { name: 'Ananda Ganga Himalayan Sanctuary', tagline: 'Foothill wellness retreat overlooking the turquoise Ganges valley', address: 'Badrinath Road, Shivpuri', basePrice: 17200, rating: 4.9, reviews: 51, style: 'palace' },
      { name: 'Byasi White-Sand River Lodge', tagline: 'Private river-stone villas with evening Ganga Aarti terrace', address: 'Kaudiyala-Byasi River Bank', basePrice: 13400, rating: 4.8, reviews: 34, style: 'fort' },
      { name: 'Tapovan Ayurvedic Forest Resort', tagline: 'Serene meditation and Vedic spa pavilions bordered by sal forests', address: 'Laxman Jhula Upper Road', basePrice: 9800, rating: 4.7, reviews: 42, style: 'coastal' },
      { name: 'Neelkanth Valley Yoga Pavilion', tagline: 'Mountain stream eco-suites with organic sattvic kitchen', address: 'Neelkanth Temple Road', basePrice: 8500, rating: 4.6, reviews: 29, style: 'coastal' }
    ]
  },
  {
    city: 'Varanasi',
    state: 'Uttar Pradesh',
    phonePrefix: '+91 542',
    properties: [
      { name: 'Darbhanga Ghat Sandstone Palace', tagline: 'Restored 1900 riverside fortress directly above Dashashwamedh steps', address: 'Munshi Ghat, Bengali Tola', basePrice: 16800, rating: 4.9, reviews: 48, style: 'fort' },
      { name: 'Assi Ghat Banarasi Silk Haveli', tagline: 'Intimate courtyard residence with morning classical raga concerts', address: 'Shivala, Assi Ghat', basePrice: 11200, rating: 4.8, reviews: 37, style: 'palace' },
      { name: 'Sarnath Bodhi Garden Retreat', tagline: 'Tranquil brick-and-terracotta sanctuary near Dhamek Stupa', address: 'Ashoka Marg, Sarnath', basePrice: 8900, rating: 4.7, reviews: 26, style: 'coastal' },
      { name: 'Nadesar Royal Carriage House', tagline: '1835 colonial manor set within mango orchards and jasmine gardens', address: 'Nadesar Palace Grounds, Cantonment', basePrice: 19200, rating: 4.9, reviews: 33, style: 'palace' }
    ]
  },
  {
    city: 'Agra',
    state: 'Uttar Pradesh',
    phonePrefix: '+91 562',
    properties: [
      { name: 'Mehtab Bagh Taj View Amarvilas', tagline: 'Mughal terraced sandstone hotel with uninterrupted views of the Taj Mahal', address: 'Taj East Gate Road', basePrice: 21500, rating: 4.9, reviews: 76, style: 'palace' },
      { name: 'Fatehpur Sikri Red Sandstone Serai', tagline: 'Imperial courtyard retreat inspired by Akbar’s walled capital', address: 'Fatehpur Sikri Heritage Road', basePrice: 11800, rating: 4.7, reviews: 32, style: 'fort' },
      { name: 'Yamuna Riverfront Pietra Dura Inn', tagline: 'Marble-inlay boutique chambers overlooking Agra Fort ramparts', address: 'Strand Road, Rakabganj', basePrice: 9200, rating: 4.6, reviews: 44, style: 'palace' },
      { name: 'Sikandra Charbagh Garden Hotel', tagline: 'Peaceful pavilion suites set amidst fountain courtyards', address: 'Mathura Road, Sikandra', basePrice: 8600, rating: 4.5, reviews: 29, style: 'grand' }
    ]
  },
  {
    city: 'Amritsar',
    state: 'Punjab',
    phonePrefix: '+91 183',
    properties: [
      { name: 'Ranjit Avenue Phulkari Haveli', tagline: 'Nanakshahi brick heritage manor minutes from the Golden Temple', address: 'Old Cantt Road, Amritsar', basePrice: 11900, rating: 4.9, reviews: 52, style: 'palace' },
      { name: 'Gobindgarh Bastion Courtyard', tagline: 'Restored 19th-century garrison quarters with authentic Amritsari kulcha kitchen', address: 'Lohgarh Gate Circle', basePrice: 9400, rating: 4.7, reviews: 38, style: 'fort' },
      { name: 'Wagah Border Mustard Farm Stay', tagline: 'Luxury agrarian estate surrounded by winter mustard fields', address: 'Attari Highway, Khasa', basePrice: 8800, rating: 4.8, reviews: 24, style: 'coastal' },
      { name: 'Hall Bazaar Clocktower Grand', tagline: 'Classic colonial hotel in the historic heart of Amritsar', address: 'Cooper Road, Civil Lines', basePrice: 7900, rating: 4.6, reviews: 41, style: 'grand' }
    ]
  },
  {
    city: 'Hyderabad',
    state: 'Telangana',
    phonePrefix: '+91 40',
    properties: [
      { name: 'Falaknuma Crest Nizam Palace', tagline: 'Hilltop neoclassical palace overlooking the City of Pearls', address: 'Engine Bowli, Falaknuma', basePrice: 22400, rating: 4.9, reviews: 64, style: 'palace' },
      { name: 'Golconda Qutb Shahi Courtyard', tagline: 'Granite-and-lime mortar boutique resort facing Golconda Fort', address: 'Ibrahim Bagh, Golconda', basePrice: 12600, rating: 4.8, reviews: 39, style: 'fort' },
      { name: 'Banjara Hills Deccan Grand', tagline: 'Terraced executive luxury hotel with Hyderabadi dum pukht dining', address: 'Road No 1, Banjara Hills', basePrice: 13800, rating: 4.8, reviews: 57, style: 'grand' },
      { name: 'Hussain Sagar Lakefront Suites', tagline: 'Contemporary waterfront chambers near Necklace Road promenade', address: 'Tank Bund Road, Somajiguda', basePrice: 9900, rating: 4.6, reviews: 46, style: 'grand' }
    ]
  },
  {
    city: 'Chennai',
    state: 'Tamil Nadu',
    phonePrefix: '+91 44',
    properties: [
      { name: 'Adyar Estuary Chettinad Manor', tagline: 'Athangudi-tiled courtyard palace with carved Burma teak pillars', address: 'MRC Nagar, Raja Annamalai Puram', basePrice: 14600, rating: 4.9, reviews: 59, style: 'palace' },
      { name: 'Covelong Coromandel Surf Resort', tagline: 'Bay of Bengal beachfront villas near Mahabalipuram shore temples', address: 'East Coast Road, Kovalam', basePrice: 15400, rating: 4.8, reviews: 47, style: 'coastal' },
      { name: 'Mylapore Kapaleeshwarar Heritage Inn', tagline: 'Traditional agraharam verandah boutique hotel with filter coffee bar', address: 'Luz Church Road, Mylapore', basePrice: 8400, rating: 4.7, reviews: 38, style: 'coastal' },
      { name: 'Guindy Park Executive Colonnade', tagline: 'Neo-Dravidian grand business hotel bordering Guindy National Park', address: ' Sardar Patel Road, Guindy', basePrice: 12200, rating: 4.8, reviews: 51, style: 'grand' }
    ]
  },
  {
    city: 'Puducherry',
    state: 'Puducherry',
    phonePrefix: '+91 413',
    properties: [
      { name: 'Rue Suffren French Quarter Villa', tagline: 'Mustard-yellow 18th-century colonial mansion in White Town', address: '14 Rue Suffren, White Town', basePrice: 11800, rating: 4.9, reviews: 49, style: 'grand' },
      { name: 'Promenade Goubert Seaface Inn', tagline: 'Louvered French-window suites directly facing the Bay of Bengal', address: 'Goubert Avenue, Beach Road', basePrice: 12900, rating: 4.8, reviews: 42, style: 'coastal' },
      { name: 'Auroville Red Earth Sanctuary', tagline: 'Sustainable rammed-earth villas set in quiet casuarina forests', address: 'Kuilapalayam, Auroville', basePrice: 9200, rating: 4.7, reviews: 35, style: 'coastal' },
      { name: 'Tamil Quarter Courtyard Maison', tagline: 'Franco-Tamil courtyard residence with terracotta tiled verandahs', address: 'Vysial Street, Heritage Town', basePrice: 8600, rating: 4.8, reviews: 31, style: 'palace' }
    ]
  },
  {
    city: 'Mysuru',
    state: 'Karnataka',
    phonePrefix: '+91 821',
    properties: [
      { name: 'Chamundi Hill Wadiyar Palace', tagline: 'Restored royal guest mansion with views of illuminated Mysuru Palace', address: 'Nazarbad Main Road, Mysuru', basePrice: 13900, rating: 4.9, reviews: 44, style: 'palace' },
      { name: 'Kabini Backwater Safari Lodge', tagline: 'Riverfront wildlife bungalows on the edge of Nagarhole reserve', address: 'Karapura, HD Kote Road', basePrice: 17800, rating: 4.9, reviews: 36, style: 'coastal' },
      { name: 'Gokulam Rosewood Boutique Villa', tagline: 'Shaded heritage home in Mysuru’s traditional ashtanga yoga quarter', address: '3rd Stage, Gokulam', basePrice: 7800, rating: 4.7, reviews: 29, style: 'coastal' },
      { name: 'Brindavan Cauvery River Pavilion', tagline: 'Terraced garden suites overlooking historic Krishnarajasagara dam', address: 'KRS Temple Road', basePrice: 9500, rating: 4.6, reviews: 25, style: 'fort' }
    ]
  },
  {
    city: 'Ooty',
    state: 'Tamil Nadu',
    phonePrefix: '+91 423',
    properties: [
      { name: 'Nilgiri Fernhill Savoy Manor', tagline: '1845 English country cottage estate surrounded by eucalyptus forests', address: 'Sylks Road, Ooty', basePrice: 13200, rating: 4.8, reviews: 41, style: 'grand' },
      { name: 'Coonoor Sims Park Tea Bungalow', tagline: 'Verandah suites overlooking Nilgiri Mountain Railway viaducts', address: 'Bedford Circle, Coonoor', basePrice: 11600, rating: 4.9, reviews: 33, style: 'coastal' },
      { name: 'Avalanche Emerald Lake Lodge', tagline: 'High-shola wilderness chalets beside pristine Avalanche trout streams', address: 'Emerald Post, Nilgiris', basePrice: 10400, rating: 4.7, reviews: 22, style: 'coastal' },
      { name: 'Doddabetta Cloud Ridge Inn', tagline: 'Cozy stone hearth suites at the highest point of the Blue Mountains', address: 'Kotagiri-Ooty Ridge Road', basePrice: 8900, rating: 4.6, reviews: 27, style: 'fort' }
    ]
  },
  {
    city: 'Darjeeling',
    state: 'West Bengal',
    phonePrefix: '+91 354',
    properties: [
      { name: 'Observatory Hill Kanchenjunga Grand', tagline: 'Heritage timber-and-stone mountain hotel facing the Kanchenjunga massif', address: 'Nehru Road,The Mall, Darjeeling', basePrice: 14800, rating: 4.9, reviews: 47, style: 'grand' },
      { name: 'Makaibari First Flush Tea Estate', tagline: 'Working 1859 biodynamic tea plantation bungalow in Kurseong valley', address: 'Pankhabari Road, Kurseong', basePrice: 13500, rating: 4.9, reviews: 31, style: 'coastal' },
      { name: 'Glenburn Rangeet River Sanctuary', tagline: 'Colonial planter suites with private Himalayan river picnic decks', address: 'Takdah Forest Block', basePrice: 16200, rating: 4.8, reviews: 24, style: 'coastal' },
      { name: 'Tiger Hill Mist Verandah Inn', tagline: 'Cedar-panelled boutique lodge with attic fireplaces and library tea lounge', address: 'Gandhi Road, Darjeeling', basePrice: 9200, rating: 4.7, reviews: 35, style: 'fort' }
    ]
  },
  {
    city: 'Coorg',
    state: 'Karnataka',
    phonePrefix: '+91 8272',
    properties: [
      { name: 'Madikeri Arabica Coffee Estate', tagline: 'Kodava ainmane courtyard villas set inside 200 acres of shade-grown coffee', address: 'Siddapura Road, Madikeri', basePrice: 14200, rating: 4.9, reviews: 53, style: 'coastal' },
      { name: 'Kabbe Hills Rainforest Pool Villas', tagline: 'Private infinity-plunge pool pavilions overlooking Western Ghats valleys', address: 'Virajpet-Chelavara Road', basePrice: 16400, rating: 4.8, reviews: 38, style: 'coastal' },
      { name: 'Cauvery Nisargadhama River Lodge', tagline: 'Bamboo-grove cottages along the banks of the upper Kaveri River', address: 'Kushalnagar Bypass', basePrice: 9600, rating: 4.7, reviews: 29, style: 'coastal' },
      { name: 'Mandalpatti Mist Peak Sanctuary', tagline: 'High-ridge stone suites with guided spice plantation trails', address: 'Abbi Falls Road, Madikeri', basePrice: 11200, rating: 4.8, reviews: 26, style: 'fort' }
    ]
  }
];

const STYLE_ASSET_PATHS: Record<'palace' | 'fort' | 'coastal' | 'grand', string> = {
  palace: '/assets/hotel-palace-hero.jpg',
  fort: '/assets/hotel-ahilya-fort.jpg',
  coastal: '/assets/hotel-goa-coastal.jpg',
  grand: '/assets/hotel-kolkata-grand.jpg'
};

async function seedDatabase(): Promise<void> {
  if (env.isProduction) {
    console.error('[HotelPro Seed] Refusing to run development seed script in production mode.');
    process.exit(1);
  }
  await connectDatabase();
  await Promise.all([
    User.deleteMany({}),
    Hotel.deleteMany({}),
    RoomType.deleteMany({}),
    PhysicalRoom.deleteMany({}),
    DailyInventory.deleteMany({}),
    Booking.deleteMany({}),
    Payment.deleteMany({}),
    Review.deleteMany({}),
    StaffAssignment.deleteMany({}),
    ServiceRequest.deleteMany({})
  ]);

  const passwordHash = await bcrypt.hash('HotelPro@2026', 12);
  const [adminUser, managerUser, staffUser, guestUser] = await User.insertMany([
    { name: 'Vikramaditya Sen (Platform Admin)', email: 'admin@hotelpro.in', passwordHash, phone: '+91 98110 44201', role: 'admin', isEmailVerified: true, accountStatus: 'active' },
    { name: 'Devika Rathore (Hotel Manager)', email: 'manager@hotelpro.in', passwordHash, phone: '+91 98290 71500', role: 'manager', isEmailVerified: true, accountStatus: 'active' },
    { name: 'Rohan Mewara (Front Desk Staff)', email: 'staff@hotelpro.in', passwordHash, phone: '+91 98291 11223', role: 'staff', isEmailVerified: true, accountStatus: 'active' },
    { name: 'Aarav Deshmukh', email: 'guest@hotelpro.in', passwordHash, phone: '+91 98201 55412', role: 'guest', isEmailVerified: true, accountStatus: 'active' }
  ]);

  // Build 100 Curated Hotels (4 Flagship + 96 across 25 Cities)
  const hotelDocsToInsert = [
    {
      name: 'Suryagarh Lake Palace & Haveli',
      slug: 'suryagarh-lake-palace-udaipur',
      tagline: 'Restored 18th-century Mewar sandstone haveli overlooking Lake Pichola',
      description: 'Carved from honey-gold sandstone along Lake Pichola with traditional courtyards and private boat jetty.',
      address: 'Haridasji Ki Magri, Pichola Shore Road',
      city: 'Udaipur',
      state: 'Rajasthan',
      country: 'India',
      contact: { phone: '+91 294 243 8800', email: 'reservations.udaipur@hotelpro.in' },
      amenities: ['Heritage Courtyard Pool', 'Ayurvedic Spa & Hammam', 'Fine Dining & Rooftop Bar', 'High-Speed Wi-Fi', '24-Hour Butler Service'],
      images: [{ url: '/assets/hotel-palace-hero.jpg', alt: 'Suryagarh Lake Palace', isPrimary: true }],
      startingPrice: 14500,
      ratingAverage: 4.9,
      ratingCount: 28,
      managers: [managerUser._id],
      operationalStatus: 'active',
      featured: true
    },
    {
      name: 'Ahilya Fort Riverside Sanctuary',
      slug: 'ahilya-fort-riverside-maheshwar',
      tagline: 'Historic 1766 citadel perched high above the sacred Narmada River ghats',
      description: 'Set within Queen Ahilyabai Holkar’s 18th-century citadel overlooking the Narmada River.',
      address: 'Ahilya Wada, Fort Citadel',
      city: 'Maheshwar',
      state: 'Madhya Pradesh',
      country: 'India',
      contact: { phone: '+91 7283 273 320', email: 'concierge.ahilya@hotelpro.in' },
      amenities: ['Narmada River View Terraces', 'Organic Farm-to-Table Dining', 'High-Speed Wi-Fi'],
      images: [{ url: '/assets/hotel-ahilya-fort.jpg', alt: 'Ahilya Fort', isPrimary: true }],
      startingPrice: 12800,
      ratingAverage: 4.8,
      ratingCount: 19,
      managers: [managerUser._id],
      operationalStatus: 'active',
      featured: true
    },
    {
      name: 'Casa Cavelossim Palms & Villas',
      slug: 'casa-cavelossim-palms-goa',
      tagline: 'Indo-Portuguese coastal sanctuary between the Sal River and Arabian Sea',
      description: 'Tucked amidst coconut groves in South Goa with private plunge pools and coastal seafood kitchen.',
      address: 'Lobo Vaddo, Cavelossim Coastal Road',
      city: 'South Goa',
      state: 'Goa',
      country: 'India',
      contact: { phone: '+91 832 287 4410', email: 'stay.goa@hotelpro.in' },
      amenities: ['Private Plunge Pools', 'Direct Beach Access', 'Ayurvedic Spa & Hammam', 'High-Speed Wi-Fi'],
      images: [{ url: '/assets/hotel-goa-coastal.jpg', alt: 'Casa Cavelossim', isPrimary: true }],
      startingPrice: 11200,
      ratingAverage: 4.7,
      ratingCount: 22,
      managers: [managerUser._id],
      operationalStatus: 'active',
      featured: true
    },
    {
      name: 'The Dalhousie Colonnade Grand',
      slug: 'the-dalhousie-colonnade-kolkata',
      tagline: 'Neoclassical urban landmark with palm-fringed courtyard in central Kolkata',
      description: 'A restored Victorian-era grand hotel steps from Victoria Memorial and Park Street.',
      address: '18 Chowringhee Place, Esplanade',
      city: 'Kolkata',
      state: 'West Bengal',
      country: 'India',
      contact: { phone: '+91 33 2249 9100', email: 'desk.kolkata@hotelpro.in' },
      amenities: ['Executive Boardrooms', 'Fine Dining & Rooftop Bar', '24-Hour Butler Service', 'High-Speed Wi-Fi'],
      images: [{ url: '/assets/hotel-kolkata-grand.jpg', alt: 'Dalhousie Colonnade', isPrimary: true }],
      startingPrice: 9800,
      ratingAverage: 4.8,
      ratingCount: 34,
      managers: [managerUser._id],
      operationalStatus: 'active',
      featured: true
    }
  ];

  let counter = 5;
  for (const citySpec of CITY_CATALOG_SPECS) {
    for (const prop of citySpec.properties) {
      const slug = `${prop.name}-${citySpec.city}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      hotelDocsToInsert.push({
        name: prop.name,
        slug,
        tagline: prop.tagline,
        description: `${prop.tagline}. Located at ${prop.address} in ${citySpec.city}, ${citySpec.state}.`,
        address: prop.address,
        city: citySpec.city,
        state: citySpec.state,
        country: 'India',
        contact: { phone: `${citySpec.phonePrefix} 240 ${100 + counter}`, email: `stay.${slug.slice(0, 10)}@hotelpro.in` },
        amenities: ['High-Speed Wi-Fi', 'Ayurvedic Spa & Hammam', '24-Hour Butler Service', 'Fine Dining & Rooftop Bar'],
        images: [{ url: STYLE_ASSET_PATHS[prop.style], alt: prop.name, isPrimary: true }],
        startingPrice: prop.basePrice,
        ratingAverage: prop.rating,
        ratingCount: prop.reviews,
        managers: [managerUser._id],
        operationalStatus: 'active',
        featured: counter <= 12
      });
      counter++;
    }
  }

  const hotels = await Hotel.insertMany(hotelDocsToInsert);

  await StaffAssignment.insertMany([
    { staff: managerUser._id, hotel: hotels[0]._id, department: 'management', shift: 'morning', isActive: true },
    { staff: staffUser._id, hotel: hotels[0]._id, department: 'front_desk', shift: 'morning', isActive: true }
  ]);

  // Create 2 Room Categories for every single one of the 100 Hotels (200 Room Categories total)
  const roomTypePayload = [];
  for (let i = 0; i < hotels.length; i++) {
    const h = hotels[i];
    roomTypePayload.push(
      {
        hotel: h._id,
        name: 'Heritage Courtyard Chamber',
        code: `HC${i + 1}`,
        description: `Signature guest chamber at ${h.name} with king bed and rain shower.`,
        maxOccupancy: { adults: 2, children: 1 },
        bedConfiguration: '1 King Bed',
        sizeSqFt: 480,
        amenities: ['Courtyard View', 'Rain Shower', 'Wi-Fi'],
        totalInventory: 5,
        basePricePerNight: h.startingPrice,
        seasonalPricing: [],
        images: [{ url: '/assets/room-deluxe-interior.jpg', alt: 'Chamber' }],
        isActive: true
      },
      {
        hotel: h._id,
        name: 'Royal Terrace Heritage Suite',
        code: `RS${i + 1}`,
        description: `Expansive suite at ${h.name} with private sit-out terrace and butler service.`,
        maxOccupancy: { adults: 3, children: 2 },
        bedConfiguration: '1 Four-Poster King Bed + Daybed',
        sizeSqFt: 790,
        amenities: ['Private Terrace', 'Soaking Tub', 'Butler Service', 'Wi-Fi'],
        totalInventory: 3,
        basePricePerNight: Math.round(h.startingPrice * 1.55),
        seasonalPricing: [],
        images: [{ url: '/assets/room-heritage-suite.jpg', alt: 'Suite' }],
        isActive: true
      }
    );
  }
  const roomTypes = await RoomType.insertMany(roomTypePayload);

  await PhysicalRoom.insertMany([
    { hotel: hotels[0]._id, roomType: roomTypes[0]._id, roomNumber: 'HCC-101', floor: 1, housekeepingStatus: 'inspected', occupancyStatus: 'vacant' },
    { hotel: hotels[0]._id, roomType: roomTypes[0]._id, roomNumber: 'HCC-102', floor: 1, housekeepingStatus: 'clean', occupancyStatus: 'vacant' }
  ]);

  const nights = getStayNightStrings('2026-10-28', '2026-10-31');
  const booking = await Booking.create({
    bookingReference: 'HPR-20261028-A101',
    guest: guestUser._id,
    guestDetails: { fullName: 'Aarav Deshmukh', email: 'guest@hotelpro.in', phone: '+91 98201 55412' },
    hotel: hotels[0]._id,
    roomType: roomTypes[0]._id,
    checkInDate: '2026-10-28',
    checkOutDate: '2026-10-31',
    nights: 3,
    guestsCount: { adults: 2, children: 0 },
    roomQuantity: 1,
    pricing: { nightlyRates: nights.map((d) => ({ date: d, ratePerRoom: 14500 })), baseAmount: 43500, taxesAndFees: 7830, discountAmount: 0, additionalCharges: 0, totalAmount: 51330, currency: 'INR' },
    status: 'confirmed',
    paymentStatus: 'paid',
    inventoryLocked: true
  });

  await Payment.create({
    booking: booking._id,
    guest: guestUser._id,
    hotel: hotels[0]._id,
    invoiceNumber: 'INV-HPR-2026-8801',
    amount: 51330,
    currency: 'INR',
    provider: 'razorpay_sandbox',
    providerOrderId: 'order_seed_a101',
    providerPaymentId: 'pay_seed_a101',
    verificationStatus: 'verified'
  });

  console.log(`[HotelPro Seed] Successfully seeded ${hotels.length} hotels and ${roomTypes.length} room categories.`);
  await disconnectDatabase();
}

seedDatabase();
