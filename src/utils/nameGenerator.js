
const adjectives = [
  'Faint', 'Stately', 'Stoic', 'Energetic', 'Proud', 'Zealous', 'Defiant', 'Fearless', 'Astral', 'Distant', 'Sheer', 'Kinetic', 'Dark', 'Prismatic', 'Kind', 'Brave', 'Gnarly', 'Tame', 'Happy', 'Deep', 'Glassy', 'Nimble', 'Swift', 'Cosmic', 'Primal', 'Sleek', 'Static', 'Latent', 'Meek', 'Sinewy', 'Bored', 'Fluid', 'Searing', 'Candid', 'Epic', 'Rugged', 'Tepid', 'Velvet', 'Stellar', 'Burly', 'Rapid', 'Sunny', 'Plucky', 'Gilded', 'Quiet', 'High', 'Eager', 'Vague', 'Lively', 'Rustic', 'Wide', 'Cavalier', 'Artful', 'Grim', 'Warm', 'Wild', 'Balmy', 'Icy', 'Urban', 'Wary', 'Sharp', 'Light', 'Taut', 'Hollow', 'Flaccid', 'Witty', 'Lithe', 'Grave', 'Crude', 'Languid', 'Solumn', 'Calm', 'Arcane', 'Stark', 'Bleak', 'Dormant', 'Fair', 'Spectral', 'Eerie', 'Fierce', 'Angry', 'Drab', 'Vicious', 'Hard', 'Mean', 'Serene', 'Dainty', 'Tired', 'Faded', 'Menial', 'Abrupt', 'Feeble', 'Rigid', 'Squalid', 'Shrewd', 'Mighty', 'Murky', 'Vapid', 'Silver', 'Bright', 'Valiant', 'Abject', 'Drifted', 'Coarse', 'Pale', 'Sly', 'Steady', 'Supple', 'Brisk', 'Verdant', 'Cold', 'Eldritch', 'Low', 'Arid', 'Hallowed', 'Devout', 'Callous', 'Gentle', 'Veiled', 'Blunt', 'Petty', 'Morose', 'Pure', 'Lush', 'Grand', 'Soft', 'Grit', 'Sullen', 'Sylvan', 'Loose', 'Golden', 'Ornate', 'Boisterous', 'Brittle', 'Jovial', 'Erudite', 'Florid', 'Vast', 'Rash', 'Clever', 'Savage', 'Hidden', 'Jagged', 'Ancient', 'Excited', 'Fabled', 'Fickle', 'Noble', 'Vivid', 'Bold', 'Prime', 'Sluggish', 'Stable', 'Placid', 'Hefty', 'Frantic', 'Potent', 'Sad', 'Dreadful', 'Pious', 'Mystic', 'Stout', 'Lean', 'Vibrant', 'Dull', 'Cunning', 'Stern', 'Smoky', 'Driven', 'Suave', 'Bracing', 'Lunar', 'Regal', 'Gloomy'
];

const nouns = [
  'Selkie', 'Otter', 'Cicada', 'Fox', 'Reindeer', 'Koala', 'Roadrunner', 'Cygnet', 'Orca', 'Banshee', 'Albatross', 'Satyr', 'Hamster', 'Sphinx', 'Jackal', 'Peacock', 'Troll', 'Gorgon', 'Minotaur', 'Mongoose', 'Husky', 'Beetle', 'Jellyfish', 'Phoenix', 'Rabbit', 'Panther', 'Shrimp', 'Scorpion', 'Swift', 'Pegasus', 'Wolf', 'Lemur', 'Gull', 'Rhino', 'Orc', 'Lamb', 'Sprite', 'Mantis', 'Yak', 'Manatee', 'Serval', 'Badger', 'Alpaca', 'Hyena', 'Calf', 'Foal', 'ArcticHare', 'Cyclops', 'Caracal', 'Hydra', 'Centaur', 'Gerbil', 'Moose', 'Quokka', 'Condor', 'Python', 'Joey', 'Eagle', 'Gnome', 'Dryad', 'Coyote', 'Manticore', 'Butterfly', 'Xenops', 'Ocelot', 'ArcticFox', 'Squid', 'Puppy', 'Jaguar', 'Quail', 'Zebra', 'Tanuki', 'Leviathan', 'Cerberus', 'Walrus', 'Thunderbird', 'Chinchilla', 'Barracuda', 'Kelpie', 'Seal', 'Chimera', 'Lynx', 'Pixie', 'Hedgehog', 'Hummingbird', 'Goose', 'Panda', 'Chick', 'Lion', 'Bison', 'Tern', 'Stingray', 'Wyvern', 'Mouse', 'Ibex', 'Sturgeon', 'Crab', 'SnowyOwl', 'Cheetah', 'Raven', 'Starfish', 'Robin', 'Heron', 'Specter', 'Vulture', 'Cricket', 'Kookaburra', 'Hornet', 'Seahorse', 'Rat', 'Narwhal', 'Swan', 'Falcon', 'Flamingo', 'Kitsune', 'Echidna', 'Piglet', 'Squirrel', 'Terrier', 'Wallaby', 'Cougar', 'Platypus', 'Duckling', 'Griffin', 'Whale', 'Lobster', 'Meerkat', 'Bobcat', 'Owl', 'Penguin', 'Octopus', 'Emu', 'Marlin', 'Mallard', 'Kangaroo', 'Dingo', 'Puffin', 'Megalodon', 'Cockatoo', 'Bunny', 'Collie', 'Shark', 'GuineaPig', 'Toucan', 'Hawk', 'Drake', 'Goblin', 'Yeti', 'Wombat', 'PolarBear', 'Macaw', 'Parrot', 'Crane', 'Stag', 'Kitten', 'Roc', 'Salmon', 'TasmanianDevil', 'Kite', 'Kraken', 'Tiger', 'Wraith', 'Llama', 'Deer', 'Mastiff', 'Sasquatch', 'Dolphin', 'Ferret', 'BlueJay', 'Dragon', 'Moth', 'Behemoth', 'Bear', 'Walleye', 'Cardinal', 'Dugong', 'Firefly', 'Osprey', 'Cobra', 'Harpy', 'Unicorn', 'Elk', 'Basilisk', 'Nymph', 'Siren', 'Newt', 'Kobold', 'Spider'
];

/**
 * Generates a stable "anonymous-adj-noun-number" name based on a string seed (like a UUID).
 * If no seed is provided, it returns a random one.
 */
export function generateAnonymousName(seed) {
  let index1, index2, num;

  if (seed) {
    // Simple hash to get stable indices from seed
    let h1 = 0;
    let h2 = 0;
    for (let i = 0; i < seed.length; i++) {
      const char = seed.charCodeAt(i);
      h1 = ((h1 << 5) - h1) + char;
      h1 |= 0; // Convert to 32bit int
      h2 = ((h2 << 7) - h2) + char;
      h2 |= 0; // Convert to 32bit int
    }
    
    index1 = Math.abs(h1) % adjectives.length;
    index2 = Math.abs(h2) % nouns.length;
    num = (Math.abs(h1 ^ h2) % 900) + 100; // 100-999
  } else {
    index1 = Math.floor(Math.random() * adjectives.length);
    index2 = Math.floor(Math.random() * nouns.length);
    num = Math.floor(Math.random() * 899) + 100;
  }

  return `${adjectives[index1]}-${nouns[index2]}-${num}`;
}
