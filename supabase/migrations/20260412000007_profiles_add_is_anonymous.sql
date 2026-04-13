-- 1. Add column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_anonymous BOOLEAN DEFAULT false;

-- 2. Backfill existing profile rows dynamically from the truth defined inside auth.users
UPDATE public.profiles p
SET is_anonymous = u.is_anonymous
FROM auth.users u
WHERE p.id = u.id;

-- 3. Update the handle_new_user function to intrinsically map the state over at user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    provided_username TEXT;
    candidate_username TEXT;
    adj_array TEXT[] := ARRAY['Faint','Stately','Stoic','Energetic','Proud','Zealous','Defiant','Fearless','Astral','Distant','Sheer','Kinetic','Dark','Prismatic','Kind','Brave','Gnarly','Tame','Happy','Deep','Glassy','Nimble','Swift','Cosmic','Primal','Sleek','Static','Latent','Meek','Sinewy','Bored','Fluid','Searing','Candid','Epic','Rugged','Tepid','Velvet','Stellar','Burly','Rapid','Sunny','Plucky','Gilded','Quiet','High','Eager','Vague','Lively','Rustic','Wide','Cavalier','Artful','Grim','Warm','Wild','Balmy','Icy','Urban','Wary','Sharp','Light','Taut','Hollow','Flaccid','Witty','Lithe','Grave','Crude','Languid','Solumn','Calm','Arcane','Stark','Bleak','Dormant','Fair','Spectral','Eerie','Fierce','Angry','Drab','Vicious','Hard','Mean','Serene','Dainty','Tired','Faded','Menial','Abrupt','Feeble','Rigid','Squalid','Shrewd','Mighty','Murky','Vapid','Silver','Bright','Valiant','Abject','Drifted','Coarse','Pale','Sly','Steady','Supple','Brisk','Verdant','Cold','Eldritch','Low','Arid','Hallowed','Devout','Callous','King','Queen','Gentle','Veiled','Blunt','Petty','Morose','Pure','Lush','Grand','Soft','Gritty','Sullen','Sylvan','Loose','Golden','Ornate','Boisterous','Brittle','Jovial','Erudite','Florid','Vast','Rash','Clever','Savage','Hidden','Jagged','Ancient','Excited','Fabled','Fickle','Noble','Vivid','Bold','Prime','Sluggish','Stable','Placid','Hefty','Frantic','Potent','Sad','Dreadful','Pious','Mystic','Stout','Lean','Vibrant','Dull','Cunning','Stern','Smoky','Driven','Suave','Bracing','Lunar','Regal','Gloomy','SolidGold'];
    noun_array TEXT[] := ARRAY['Selkie','Otter','Cicada','Fox','Reindeer','Koala','Roadrunner','Cygnet','Orca','Banshee','Albatross','Satyr','Hamster','Sphinx','Jackal','Peacock','Troll','Gorgon','Minotaur','Mongoose','Husky','Beetle','Jellyfish','Phoenix','Rabbit','Panther','Shrimp','Scorpion','Swift','Pegasus','Wolf','Lemur','Gull','Rhino','Orc','Lamb','Sprite','Mantis','Yak','Manatee','Serval','Badger','Alpaca','Hyena','Calf','Foal','ArcticHare','Cyclops','Caracal','Hydra','Centaur','Gerbil','Moose','Quokka','Condor','Python','Joey','Eagle','Gnome','Dryad','Coyote','Manticore','Butterfly','Xenops','Ocelot','ArcticFox','Squid','Puppy','Jaguar','Quail','Zebra','Tanuki','Leviathan','Cerberus','Walrus','Thunderbird','Chinchilla','Barracuda','Kelpie','Seal','Chimera','Lynx','Pixie','Hedgehog','Hummingbird','Goose','Panda','Chick','Lion','Bison','Tern','Stingray','Wyvern','Mouse','Ibex','Sturgeon','Crab','SnowyOwl','Cheetah','Raven','Starfish','Robin','Heron','Specter','Vulture','Cricket','Gizzard','Kookaburra','Hornet','Seahorse','MetalGear','Rat','Narwhal','Swan','Falcon','Flamingo','Kitsune','Echidna','Piglet','Squirrel','Terrier','Wallaby','Cougar','Platypus','Duckling','Griffin','Whale','Lobster','Meerkat','Bobcat','Owl','Penguin','Octopus','Emu','Marlin','Mallard','Kangaroo','Dingo','Puffin','Megalodon','Cockatoo','Bunny','Collie','Shark','GuineaPig','Toucan','Hawk','Drake','Goblin','Yeti','Wombat','PolarBear','Macaw','Parrot','Crane','Stag','Kitten','Roc','Salmon','TasmanianDevil','Kite','Kraken','Tiger','Wraith','Llama','Deer','Mastiff','Sasquatch','Dolphin','Ferret','BlueJay','Dragon','Moth','Behemoth','Bear','Walleye','Cardinal','Dugong','Firefly','Osprey','Cobra','Harpy','Unicorn','Elk','Basilisk','Nymph','Siren','Newt','Kobold','Spider','Impala','Magikarp'];
    adj_idx INT;
    noun_idx INT;
    base_num INT;
    duplicate_exists BOOLEAN;
BEGIN
    provided_username := new.raw_user_meta_data->>'username';

    IF provided_username IS NOT NULL AND trim(provided_username) != '' THEN
        candidate_username := provided_username;
    ELSE
        adj_idx := 1 + floor(random() * array_length(adj_array, 1))::int;
        noun_idx := 1 + floor(random() * array_length(noun_array, 1))::int;
        base_num := floor(random() * 899 + 100)::int;
        
        LOOP
            candidate_username := adj_array[adj_idx] || noun_array[noun_idx] || base_num::text;
            SELECT EXISTS(SELECT 1 FROM public.profiles WHERE username = candidate_username) INTO duplicate_exists;
            IF NOT duplicate_exists THEN EXIT; END IF;
            base_num := base_num + 1;
        END LOOP;
    END IF;

    -- Insert new profile row including is_anonymous state
    INSERT INTO public.profiles (id, username, locale, is_anonymous)
    VALUES (new.id, candidate_username, COALESCE(new.raw_user_meta_data->>'locale', 'en-US'), new.is_anonymous);

    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 4. Automatically sync profile upgrades if the user registers their anonymous account
CREATE OR REPLACE FUNCTION public.handle_user_update()
RETURNS TRIGGER AS $$
BEGIN
    -- If a user transitions from anonymous to properly registered, reflect this!
    IF OLD.is_anonymous = true AND NEW.is_anonymous = false THEN
        UPDATE public.profiles SET is_anonymous = false WHERE id = NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
CREATE TRIGGER on_auth_user_updated
AFTER UPDATE ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_user_update();
