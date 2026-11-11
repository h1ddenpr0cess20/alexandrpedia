/**
 * The wall collections surrounding the central AI library.
 *
 * These are title manifests, not fabricated article text. The browser reads
 * only committed data/<source>/<title>.json snapshots. The snapshot scripts
 * import this same manifest when a collection is ready to be populated.
 */

const groups = (sectionId, entries) => Object.freeze(entries.flatMap(({ shelf, titles }) =>
  titles.map((title) => Object.freeze({ title, kind: 'topic', sectionId, shelf })),
));

export const SECTION_NAMES = Object.freeze({
  ai: 'Artificial Intelligence',
  history: 'History & Science',
  entertainment: 'American Popular Culture',
  philosophy: 'Philosophy, Literature & the Arts',
});

const HISTORY = groups('history', [
  { shelf: 'Ancient & classical', titles: [
    'Ancient Greece', 'Ancient Rome', 'Ancient Egypt', 'Mesopotamia', 'Persian Empire',
    'Maya civilization', 'Indus Valley Civilisation', 'Julius Caesar', 'Cleopatra',
  ] },
  { shelf: 'Medieval & early modern', titles: [
    'Middle Ages', 'Renaissance', 'Genghis Khan', 'Ottoman Empire', 'Age of Discovery',
  ] },
  { shelf: 'Revolutions & modern era', titles: [
    'Industrial Revolution', 'French Revolution', 'Napoleon', 'American Revolution',
    'Abraham Lincoln', 'American Civil War',
  ] },
  { shelf: '20th century', titles: [
    'World War I', 'World War II', 'Cold War', 'Nelson Mandela',
    'Civil rights movement', 'Martin Luther King Jr.',
  ] },
]);

const HIDDEN_HISTORY = groups('history', [
  { shelf: 'Lost empires & forgotten peoples', titles: [
    'Hittites', 'Minoan civilization', 'Bronze Age collapse', 'Sea Peoples', 'Phoenicia',
    'Carthage', 'Nabataeans', 'Scythians', 'Olmecs', 'Kingdom of Aksum', 'Khmer Empire',
    'Srivijaya', 'Mali Empire', 'Mansa Musa', 'Songhai Empire', 'Great Zimbabwe', 'Cahokia',
    'Easter Island', 'Byzantine Empire', 'Republic of Venice', 'Hanseatic League', 'Varangian Guard',
  ] },
  { shelf: 'Curiosities & strange episodes', titles: [
    'Library of Alexandria', 'Antikythera mechanism', 'Voynich manuscript', "Children's Crusade",
    'Dancing plague of 1518', 'Defenestrations of Prague', 'Tulip mania', "War of Jenkins' Ear",
    'Year Without a Summer', 'Taiping Rebellion', 'Pig War', 'Carrington Event', 'Tunguska event',
    'Great Molasses Flood', 'Radium Girls', 'Emu War',
  ] },
]);

const SCIENCE = groups('history', [
  { shelf: 'Physics & space', titles: [
    'Physics', 'Quantum mechanics', 'Theory of relativity', 'Black hole', 'Cosmology',
    'Solar System', 'James Webb Space Telescope', 'Astronomy', 'Planetary science',
    'Thermodynamics', 'Electromagnetism', 'Particle physics', 'Standard Model', 'Higgs boson',
    'String theory', 'Dark matter', 'Dark energy', 'Big Bang', 'Neutron star', 'Exoplanet',
    'Gravitational wave', 'Galaxy', 'Milky Way', 'Sun', 'Moon', 'Mars',
  ] },
  { shelf: 'Mathematics', titles: [
    'Mathematics', 'Calculus', 'Prime number', 'Chaos theory', 'Game theory',
    'Probability theory', 'Topology', 'Fibonacci sequence',
  ] },
  { shelf: 'Life sciences', titles: [
    'Evolution', 'DNA', 'Genetics', 'Cell biology', 'Human brain', 'Ecology',
    'Microbiology', 'Animal', 'Mammal', 'Bird', 'Reptile', 'Insect', 'Octopus',
    'Photosynthesis', 'Immune system', 'Virus', 'Bacteria', 'Vaccine', 'Antibiotic',
    'CRISPR gene editing', 'Neuroscience', 'Human Genome Project', 'Dinosaur', 'Fossil',
  ] },
  { shelf: 'Earth & climate', titles: [
    'Periodic table', 'Chemical reaction', 'Plate tectonics', 'Climate change',
    'Geology', 'Oceanography', 'Earth science', 'Meteorology', 'Glacier',
    'Chemistry', 'Organic chemistry', 'Volcano', 'Earthquake', 'Tsunami', 'Tropical cyclone',
  ] },
  { shelf: 'Nature & geography', titles: [
    'Geography', 'Physical geography', 'Mountain', 'Forest', 'Rainforest', 'Desert',
    'Coral reef', 'Waterfall', 'National park', 'Biodiversity', 'Plant', 'Tree',
    'Flower', 'Fungus', 'Whale', 'Wolf',
  ] },
]);

const ENTERTAINMENT = groups('entertainment', [
  { shelf: '1900–1929 · The foundations', titles: [
    'Vaudeville', 'Tin Pan Alley', 'Ragtime', 'Jazz', 'Harlem Renaissance',
    'Silent film', 'Hollywood', 'Charlie Chaplin', 'Buster Keaton',
    'Pulp magazine', 'Comic strip', 'Radio broadcasting', 'Broadway theatre',
    'Jazz Age', 'Ziegfeld Follies',
  ] },
  { shelf: '1930–1949 · The golden age', titles: [
    'Golden Age of Hollywood', 'Film noir', 'Walt Disney', 'Mickey Mouse',
    'Looney Tunes', 'Superman', 'Golden Age of Comic Books', 'Swing music',
    'Big band', 'Blues', 'Country music', 'Frank Sinatra', 'Judy Garland',
    'Humphrey Bogart', 'Casablanca', 'Gone with the Wind', 'The Wizard of Oz',
    'Drive-in theater',
  ] },
  { shelf: '1950–1969 · Modern pop culture', titles: [
    'Rock and roll', 'Elvis Presley', 'Chuck Berry', 'Little Richard', 'Motown',
    'Soul music', 'The Beach Boys', 'Bob Dylan', 'Woodstock', 'Surf culture',
    'American Bandstand', 'The Ed Sullivan Show', 'I Love Lucy', 'The Twilight Zone',
    'Star Trek', 'Peanuts', 'Marvel Comics', 'Barbie', 'Disneyland',
    'James Dean', 'Marilyn Monroe',
  ] },
  { shelf: '1970–1989 · The blockbuster era', titles: [
    'Disco', 'Punk rock', 'Hip-hop', 'Rap music', 'Heavy metal', 'MTV',
    'Music video', 'Michael Jackson', 'Madonna', 'Prince', 'Bruce Springsteen',
    'Saturday Night Live', 'Star Wars', 'Jaws', 'Rocky', 'The Godfather',
    'Saturday-morning cartoon', 'Atari', 'Arcade game', 'Dungeons & Dragons',
    'Professional wrestling', 'The Muppets', 'John Hughes',
  ] },
  { shelf: '1990–2009 · The modern media era', titles: [
    'Grunge', 'Alternative rock', 'Gangsta rap', 'Contemporary R&B',
    'Boy band', 'Girl group', 'Nirvana', 'Tupac Shakur', 'The Notorious B.I.G.',
    'The Simpsons', 'Seinfeld', 'Friends (1994 TV series)', 'The X-Files',
    'South Park', 'Reality television', 'Pokémon', 'Pixar', 'World Wide Web',
    'Napster', 'YouTube', 'American Idol', 'The Sopranos', 'The Matrix',
  ] },
  { shelf: '2010–present · Contemporary culture', titles: [
    'Streaming television', 'Netflix', 'Marvel Cinematic Universe',
    'Superhero film', 'Beyoncé', 'Taylor Swift', 'Kendrick Lamar', 'Drake',
    'Billie Eilish', 'Social media', 'Internet meme', 'Viral video',
    'Influencer', 'Podcast', 'TikTok', 'Twitch (service)', 'Comic-Con',
    'Super Bowl halftime show', 'Video game culture',
  ] },
  { shelf: 'Across the decades · Cultural movements', titles: [
    'American advertising', 'Fast food', 'Celebrity', 'Tabloid journalism',
    'Consumer electronics', 'American horror film', 'Science fiction',
    'Sneaker culture', 'Hip-hop fashion', 'B movie', 'Theme park',
    'Video game history',
  ] },
]);

const PHILOSOPHY = groups('philosophy', [
  { shelf: 'Philosophy & reasoning', titles: [
    'Philosophy', 'Ethics', 'Logic', 'Metaphysics', 'Epistemology',
    'Existentialism', 'Stoicism', 'Aesthetics', 'Political philosophy',
  ] },
  { shelf: 'Society & power', titles: [
    'Democracy', 'Capitalism', 'Socialism', 'Freedom of speech',
    'Human rights', 'Censorship', 'Propaganda', 'Liberalism',
  ] },
  { shelf: 'Mind & culture', titles: [
    'Consciousness', 'Free will', 'Language', 'Mythology', 'Psychology',
    'Philosophy of mind', 'Religion', 'Critical thinking',
  ] },
]);

const LITERATURE = groups('philosophy', [
  { shelf: 'Ancient & classic works', titles: [
    'Literature', 'Poetry', 'Novel', 'Epic of Gilgamesh', 'Homer', 'Iliad', 'Odyssey',
    'Dante Alighieri', 'Divine Comedy', 'William Shakespeare', 'Hamlet',
    'Miguel de Cervantes', 'Don Quixote', 'Romanticism', 'Gothic fiction',
  ] },
  { shelf: 'The novel & modern literature', titles: [
    'Jane Austen', 'Pride and Prejudice', 'Charles Dickens', 'Herman Melville', 'Moby-Dick',
    'Mark Twain', 'Emily Dickinson', 'Walt Whitman', 'Leo Tolstoy', 'War and Peace',
    'Fyodor Dostoevsky', 'Crime and Punishment', 'Modernism', 'Virginia Woolf', 'James Joyce',
    'Ulysses (novel)', 'Franz Kafka', 'George Orwell', 'Nineteen Eighty-Four',
    'Gabriel García Márquez', 'One Hundred Years of Solitude', 'Toni Morrison',
  ] },
  { shelf: 'The arts', titles: [
    'Art', 'Painting', 'Sculpture', 'Architecture', 'Art history', 'Impressionism',
    'Cubism', 'Surrealism', 'Abstract expressionism', 'Leonardo da Vinci', 'Michelangelo',
    'Rembrandt', 'Vincent van Gogh', 'Pablo Picasso', 'Frida Kahlo', 'Photography',
    'Classical music', 'Johann Sebastian Bach', 'Wolfgang Amadeus Mozart',
    'Ludwig van Beethoven', 'Opera', 'Ballet', 'Theatre',
  ] },
]);

/**
 * Returns the center AI catalog plus the three wall collections (the fourth wall is the entryway).
 * AI entries keep their existing kinds; new editorial subjects are topics
 * grouped by their shelf label or era.
 */
export function catalogsForSections(aiCatalog) {
  if (!Array.isArray(aiCatalog)) throw new TypeError('The AI catalog must be an array.');
  return Object.freeze({
    ai: Object.freeze([...aiCatalog]),
    history: Object.freeze([...HISTORY, ...HIDDEN_HISTORY, ...SCIENCE]),
    entertainment: ENTERTAINMENT,
    philosophy: Object.freeze([...PHILOSOPHY, ...LITERATURE]),
  });
}

/** One deduplicated manifest for explicit snapshot-import and validation scripts. */
export function allCatalogEntries(aiCatalog) {
  const collections = catalogsForSections(aiCatalog);
  const seen = new Set();
  const result = [];
  for (const collection of Object.values(collections)) {
    for (const entry of collection) {
      const normalized = entry.title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
      if (seen.has(normalized)) continue;
      seen.add(normalized);
      result.push(entry);
    }
  }
  return result;
}
