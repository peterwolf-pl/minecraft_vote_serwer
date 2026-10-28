package pl.peterwolf.mka.vote;

import org.bukkit.Bukkit;
import org.bukkit.Difficulty;
import org.bukkit.GameMode;
import org.bukkit.Location;
import org.bukkit.Material;
import org.bukkit.World;
import org.bukkit.WorldCreator;
import org.bukkit.entity.Player;
import org.bukkit.generator.ChunkGenerator;
import org.bukkit.plugin.java.JavaPlugin;

public final class VoteRoom {
    public static final String NAME = "vote_room";
    public static final int Y = 80;
    private final World world;

    public VoteRoom(JavaPlugin plugin) {
        World found = Bukkit.getWorld(NAME);
        if (found == null) {
            WorldCreator creator = new WorldCreator(NAME);
            creator.generator(new ChunkGenerator() {
                @Override public boolean shouldGenerateNoise() { return false; }
                @Override public boolean shouldGenerateSurface() { return false; }
                @Override public boolean shouldGenerateCaves() { return false; }
                @Override public boolean shouldGenerateDecorations() { return false; }
                @Override public boolean shouldGenerateStructures() { return false; }
                @Override public boolean shouldGenerateMobs() { return false; }
            });
            found = creator.createWorld();
        }
        if (found == null) throw new IllegalStateException("Unable to create voting world");
        world = found;
        world.setDifficulty(Difficulty.PEACEFUL);
        world.setTime(6000);
        world.setStorm(false);
        world.setThundering(false);
        world.getWorldBorder().setCenter(7.5, 7.5);
        world.getWorldBorder().setSize(10);
        construct();
        plugin.getLogger().info("Voting room ready: 10x10 in world " + NAME);
    }

    private void construct() {
        for (int x = 3; x <= 12; x++) for (int z = 3; z <= 12; z++) {
            for (int y = 80; y <= 86; y++) {
                Material type = Material.AIR;
                boolean wall = x == 3 || x == 12 || z == 3 || z == 12;
                if (y == 80) type = (x + z) % 2 == 0 ? Material.POLISHED_ANDESITE : Material.SMOOTH_STONE;
                else if (y == 86) type = Material.STONE_BRICKS;
                else if (wall) {
                    boolean window = (x == 3 || x == 12) && z >= 7 && z <= 8 && y >= 82 && y <= 83;
                    type = window ? Material.GLASS : (y == 81 || y == 85 ? Material.CHISELED_STONE_BRICKS : Material.STONE_BRICKS);
                }
                world.getBlockAt(x, y, z).setType(type, false);
            }
        }
        for (int x : new int[]{5, 10}) for (int z : new int[]{5, 10}) {
            world.getBlockAt(x, 86, z).setType(Material.SEA_LANTERN, false);
        }
        world.getBlockAt(6, 81, 5).setType(Material.QUARTZ_BLOCK, false);
        world.getBlockAt(9, 81, 5).setType(Material.QUARTZ_BLOCK, false);
        world.getBlockAt(6, 81, 6).setType(Material.LECTERN, false);
        world.getBlockAt(9, 81, 6).setType(Material.LECTERN, false);
        world.setSpawnLocation(7, 81, 10);
    }

    public World getWorld() { return world; }
    public boolean isRoom(World candidate) { return candidate != null && candidate.getUID().equals(world.getUID()); }
    public Location spawn() { return new Location(world, 7.5, 81, 10.5, 180f, 0f); }

    public void preparePlayer(Player player) {
        player.setGameMode(GameMode.ADVENTURE);
        player.setFoodLevel(20);
        player.teleport(spawn());
    }
    public boolean isVoteLectern(Location location) {
        return isRoom(location.getWorld()) && location.getBlockX() == 6 && location.getBlockY() == 81 && location.getBlockZ() == 6;
    }
    public boolean isAppealLectern(Location location) {
        return isRoom(location.getWorld()) && location.getBlockX() == 9 && location.getBlockY() == 81 && location.getBlockZ() == 6;
    }
}
