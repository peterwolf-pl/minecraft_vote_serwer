package pl.peterwolf.mka.vote;

import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.concurrent.CompletableFuture;

public final class BridgeClient {
    private final String baseUrl;
    private final String token;
    private final HttpClient client;

    public BridgeClient(String baseUrl, String token) {
        this.baseUrl = baseUrl.replaceAll("/+$", "");
        this.token = token;
        if (token == null || token.length() < 32) throw new IllegalArgumentException("MC_BRIDGE_TOKEN must contain 32+ characters");
        URI uri = URI.create(this.baseUrl);
        if (!(uri.getScheme().equals("http") || uri.getScheme().equals("https"))) {
            throw new IllegalArgumentException("Invalid bridge scheme");
        }
        this.client = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();
    }

    public CompletableFuture<JsonObject> postVote(String uuid, String choice) {
        JsonObject body = new JsonObject();
        body.addProperty("uuid", uuid);
        body.addProperty("choice", choice);
        return post("/internal/vote", body);
    }

    public CompletableFuture<JsonObject> postAppeal(String uuid) {
        JsonObject body = new JsonObject();
        body.addProperty("uuid", uuid);
        body.addProperty("consent", true);
        return post("/internal/appeal", body);
    }

    private CompletableFuture<JsonObject> post(String endpoint, JsonObject body) {
        HttpRequest req = HttpRequest.newBuilder(URI.create(baseUrl + endpoint))
            .timeout(Duration.ofSeconds(8))
            .header("Authorization", "Bearer " + token)
            .header("Content-Type", "application/json")
            .POST(HttpRequest.BodyPublishers.ofString(body.toString()))
            .build();
        return client.sendAsync(req, HttpResponse.BodyHandlers.ofString()).thenApply(this::parse);
    }

    public CompletableFuture<JsonObject> getResults() {
        HttpRequest req = HttpRequest.newBuilder(URI.create(baseUrl + "/api/results"))
            .timeout(Duration.ofSeconds(8))
            .GET()
            .build();
        return client.sendAsync(req, HttpResponse.BodyHandlers.ofString()).thenApply(this::parse);
    }

    private JsonObject parse(HttpResponse<String> response) {
        if (response.statusCode() != 200) throw new IllegalStateException("Voting API HTTP " + response.statusCode());
        JsonObject json = JsonParser.parseString(response.body()).getAsJsonObject();
        if (json.has("error")) throw new IllegalStateException(json.get("error").getAsString());
        return json;
    }
}
