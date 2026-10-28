package pl.peterwolf.mka.vote;

import com.google.gson.JsonObject;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.function.Consumer;
import net.kyori.adventure.text.Component;
import org.bukkit.Bukkit;
import org.bukkit.Material;
import org.bukkit.command.Command;
import org.bukkit.command.CommandSender;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.Listener;
import org.bukkit.event.block.Action;
import org.bukkit.event.block.BlockBreakEvent;
import org.bukkit.event.block.BlockPlaceEvent;
import org.bukkit.event.inventory.InventoryClickEvent;
import org.bukkit.event.inventory.InventoryDragEvent;
import org.bukkit.event.player.PlayerInteractEvent;
import org.bukkit.event.player.PlayerJoinEvent;
import org.bukkit.event.player.PlayerMoveEvent;
import org.bukkit.inventory.EquipmentSlot;
import org.bukkit.inventory.Inventory;
import org.bukkit.inventory.ItemStack;
import org.bukkit.inventory.meta.ItemMeta;
import org.bukkit.plugin.java.JavaPlugin;

public final class MkaVotePlugin extends JavaPlugin implements Listener {
    private static final String VOTE_TITLE = "MKA - GLOSOWANIE";
    private static final String APPEAL_TITLE = "MKA - PODPIS APELU";
    private VoteRoom room;
    private BridgeClient bridge;

    @Override
    public void onEnable() {
        saveDefaultConfig();
        String token = System.getenv("MC_BRIDGE_TOKEN");
        if (token == null || token.isBlank()) token = getConfig().getString("bridge-token", "");
        String url = System.getenv("MC_BRIDGE_URL");
        if (url == null || url.isBlank()) url = getConfig().getString("bridge-url", "http://127.0.0.1:3000");
        try { bridge = new BridgeClient(url, token); }
        catch (Exception e) {
            getLogger().severe("Voting bridge unavailable: " + e.getMessage());
            getServer().getPluginManager().disablePlugin(this);
            return;
        }
        room = new VoteRoom(this);
        getServer().getPluginManager().registerEvents(this, this);
        if (Bukkit.getPluginManager().getPlugin("ViaBackwards") == null ||
            Bukkit.getPluginManager().getPlugin("ViaVersion") == null) {
            getLogger().warning("Missing ViaVersion or ViaBackwards: old clients will not be supported");
        }
        for (Player player : Bukkit.getOnlinePlayers()) room.preparePlayer(player);
    }

    @EventHandler
    public void onJoin(PlayerJoinEvent event) {
        Bukkit.getScheduler().runTask(this, () -> {
            Player player = event.getPlayer();
            if (!player.isOnline()) return;
            room.preparePlayer(player);
            player.sendMessage("MKA: Lewy lectern = glosowanie, prawy lectern = podpis apelu.");
            player.sendMessage("Mozesz tez wpisac /vote yes, /vote no, /appeal sign albo /results.");
        });
    }

    @EventHandler
    public void onInteract(PlayerInteractEvent event) {
        if (event.getHand() != EquipmentSlot.HAND || event.getAction() != Action.RIGHT_CLICK_BLOCK) return;
        if (event.getClickedBlock() == null) return;
        if (!room.isRoom(event.getClickedBlock().getWorld())) return;
        if (event.getClickedBlock().getType() != Material.LECTERN) {
            event.setCancelled(true);
            return;
        }
        event.setCancelled(true);
        Player player = event.getPlayer();
        if (room.isVoteLectern(event.getClickedBlock().getLocation())) {
            Bukkit.getScheduler().runTask(this, () -> openVoteMenu(player));
        } else if (room.isAppealLectern(event.getClickedBlock().getLocation())) {
            Bukkit.getScheduler().runTask(this, () -> openAppealMenu(player));
        }
    }

    private ItemStack icon(Material material, String name, String... lore) {
        ItemStack stack = new ItemStack(material);
        ItemMeta meta = stack.getItemMeta();
        meta.customName(Component.text(name));
        List<Component> components = new ArrayList<>();
        for (String line : lore) components.add(Component.text(line));
        meta.lore(components);
        stack.setItemMeta(meta);
        return stack;
    }

    private void openVoteMenu(Player player) {
        Inventory menu = Bukkit.createInventory(null, 27, Component.text(VOTE_TITLE));
        menu.setItem(4, icon(Material.WRITABLE_BOOK, "Przyszlosc Muzeum Ksiazki Artystycznej",
            "Czy popierasz niezaleznosc MKA w Lodzi?", "Wybierz TAK lub NIE. Jeden glos na konto."));
        menu.setItem(11, icon(Material.LIME_WOOL, "TAK - popieram niezaleznosc", "Kliknij, aby oddac glos."));
        menu.setItem(15, icon(Material.RED_WOOL, "NIE - nie popieram", "Kliknij, aby oddac glos."));
        menu.setItem(22, icon(Material.BARRIER, "Zamknij"));
        player.openInventory(menu);
    }

    private void openAppealMenu(Player player) {
        Inventory menu = Bukkit.createInventory(null, 27, Component.text(APPEAL_TITLE));
        menu.setItem(4, icon(Material.BOOK, "Apel w obronie MKA",
            "Twoj UUID bedzie publicznym podpisem.",
            "Miasto: MINECRAFT. Email nie jest wymagany."));
        menu.setItem(11, icon(Material.EMERALD, "Zgadzam sie i podpisuje",
            "Zgoda na publikacje UUID i przetwarzanie podpisu.",
            "Kliknij, aby zapisac podpis."));
        menu.setItem(15, icon(Material.BARRIER, "Anuluj"));
        player.openInventory(menu);
    }

    @EventHandler
    public void onClick(InventoryClickEvent event) {
        if (!(event.getWhoClicked() instanceof Player player)) return;
        String title = net.kyori.adventure.text.serializer.plain.PlainTextComponentSerializer.plainText().serialize(event.getView().title());
        if (!title.equals(VOTE_TITLE) && !title.equals(APPEAL_TITLE)) return;
        event.setCancelled(true);
        if (event.getClickedInventory() != event.getView().getTopInventory()) return;
        int slot = event.getRawSlot();
        if (title.equals(VOTE_TITLE)) {
            if (slot == 11 || slot == 15) {
                player.closeInventory();
                castVote(player, slot == 11 ? "yes" : "no");
            } else if (slot == 22) player.closeInventory();
        } else {
            if (slot == 11) {
                player.closeInventory();
                signAppeal(player);
            } else if (slot == 15) player.closeInventory();
        }
    }

    @EventHandler
    public void onDrag(InventoryDragEvent event) {
        String title = net.kyori.adventure.text.serializer.plain.PlainTextComponentSerializer.plainText().serialize(event.getView().title());
        if (title.equals(VOTE_TITLE) || title.equals(APPEAL_TITLE)) event.setCancelled(true);
    }

    private void tell(Player player, String text) {
        if (player.isOnline()) player.sendMessage(text);
    }

    private void response(Player player, CompletableFuture<JsonObject> call, Consumer<JsonObject> success) {
        tell(player, "MKA: Trwa zapisywanie...");
        call.whenComplete((result, error) -> Bukkit.getScheduler().runTask(this, () -> {
            if (error != null) {
                getLogger().warning("Bridge error: " + error.getMessage());
                tell(player, "Blad zapisu. Sprobuj ponownie. Nie oddano glosu.");
            } else success.accept(result);
        }));
    }

    private void castVote(Player player, String choice) {
        response(player, bridge.postVote(player.getUniqueId().toString(), choice), body -> {
            boolean created = body.get("created").getAsBoolean();
            String saved = body.get("choice").getAsString().equals("yes") ? "TAK" : "NIE";
            tell(player, created ? "Glos " + saved + " zostal zapisany." : "Juz glosowales. Twoj glos: " + saved);
        });
    }

    private void signAppeal(Player player) {
        response(player, bridge.postAppeal(player.getUniqueId().toString()), body -> {
            boolean created = body.get("created").getAsBoolean();
            String status = body.get("status").getAsString();
            tell(player, created
                ? "Podpis zapisany. Status publikacji: " + status
                : "Podpis istnieje. Status publikacji: " + status);
        });
    }

    private void results(Player player) {
        response(player, bridge.getResults(), body -> {
            JsonObject votes = body.getAsJsonObject("votes");
            JsonObject appeal = body.getAsJsonObject("appeal");
            tell(player, "MKA: TAK " + votes.get("yes").getAsInt() +
                ", NIE " + votes.get("no").getAsInt() +
                ", RAZEM " + votes.get("total").getAsInt());
            tell(player, "Podpisy: " + appeal.get("total").getAsInt() +
                ", opublikowane: " + appeal.get("synced").getAsInt());
        });
    }

    @Override
    public boolean onCommand(CommandSender sender, Command cmd, String label, String[] args) {
        if (!(sender instanceof Player player)) {
            sender.sendMessage("Tylko gracz z uwierzytelnionym UUID moze glosowac.");
            return true;
        }
        if (cmd.getName().equalsIgnoreCase("vote")) {
            if (args.length != 1 || !(args[0].equalsIgnoreCase("yes") || args[0].equalsIgnoreCase("no"))) {
                player.sendMessage("Uzyj /vote yes lub /vote no.");
            } else castVote(player, args[0].toLowerCase(java.util.Locale.ROOT));
            return true;
        }
        if (cmd.getName().equalsIgnoreCase("appeal")) {
            if (args.length != 1 || !args[0].equalsIgnoreCase("sign")) {
                player.sendMessage("Wpisz /appeal sign, by zgodzic sie na publikacje UUID.");
            } else signAppeal(player);
            return true;
        }
        if (cmd.getName().equalsIgnoreCase("results")) {
            results(player);
            return true;
        }
        return false;
    }

    @EventHandler
    public void onBreak(BlockBreakEvent event) {
        if (room.isRoom(event.getBlock().getWorld())) event.setCancelled(true);
    }

    @EventHandler
    public void onPlace(BlockPlaceEvent event) {
        if (room.isRoom(event.getBlock().getWorld())) event.setCancelled(true);
    }

    @EventHandler
    public void onMove(PlayerMoveEvent event) {
        Player player = event.getPlayer();
        if (!room.isRoom(player.getWorld()) || event.getTo() == null) return;
        if (event.getTo().getY() < 76) {
            Bukkit.getScheduler().runTask(this, () -> player.teleport(room.spawn()));
        }
    }
}
