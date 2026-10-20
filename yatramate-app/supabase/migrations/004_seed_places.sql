insert into public.places
  (
    destination,
    name,
    category,
    description,
    address,
    maps_query,
    published
  )
values
  (
    'Hyderabad',
    'Charminar',
    'attraction',
    'Explore one of Hyderabad’s historic landmarks.',
    'Hyderabad, Telangana',
    'Charminar, Hyderabad, Telangana, India',
    true
  ),
  (
    'Hyderabad',
    'Golconda Fort',
    'attraction',
    'A historic fort to include in your Hyderabad itinerary.',
    'Hyderabad, Telangana',
    'Golconda Fort, Hyderabad, Telangana, India',
    true
  ),
  (
    'Manali',
    'Hidimba Devi Temple',
    'temple',
    'A historic temple surrounded by cedar woodland.',
    'Manali, Himachal Pradesh',
    'Hidimba Devi Temple, Manali, Himachal Pradesh, India',
    true
  ),
  (
    'Manali',
    'Solang Valley',
    'attraction',
    'A mountain destination near Manali.',
    'Near Manali, Himachal Pradesh',
    'Solang Valley, Himachal Pradesh, India',
    true
  ),
  (
    'Goa',
    'Basilica of Bom Jesus',
    'attraction',
    'A historic church in Old Goa.',
    'Old Goa, Goa',
    'Basilica of Bom Jesus, Old Goa, Goa, India',
    true
  ),
  (
    'Goa',
    'Fort Aguada',
    'attraction',
    'Explore Goa’s coastal fort heritage.',
    'Goa',
    'Fort Aguada, Goa, India',
    true
  ),
  (
    'Jaipur',
    'Hawa Mahal',
    'attraction',
    'Discover Jaipur’s distinctive Palace of Winds.',
    'Jaipur, Rajasthan',
    'Hawa Mahal, Jaipur, Rajasthan, India',
    true
  ),
  (
    'Jaipur',
    'Amber Fort',
    'attraction',
    'A historic fort and palace complex in the Jaipur area.',
    'Amer, Jaipur, Rajasthan',
    'Amber Fort, Amer, Jaipur, Rajasthan, India',
    true
  ),
  (
    'Tirupati',
    'Sri Kapileswara Swamy Temple',
    'temple',
    'A temple at Kapila Theertham in Tirupati.',
    'Tirupati, Andhra Pradesh',
    'Sri Kapileswara Swamy Temple, Kapila Theertham, Tirupati, India',
    true
  ),
  (
    'Munnar',
    'Tea Museum',
    'attraction',
    'Learn about the tea heritage of Munnar.',
    'Nallathanni Estate, Munnar, Kerala',
    'Tea Museum, Nallathanni Estate, Munnar, Kerala, India',
    true
  ),
  (
    'Munnar',
    'Mattupetty',
    'attraction',
    'Explore the Mattupetty area near Munnar.',
    'Near Munnar, Kerala',
    'Mattupetty Dam, Munnar, Kerala, India',
    true
  )
on conflict (destination, name) do nothing;