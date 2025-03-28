/// <reference path="./anime-torrent-provider.d.ts" />

import fetch from "node-fetch";

class Provider {
    private api = "https://torrentio-api.example.com"; // Replace with the actual Torrentio API

    async getSettings(): Promise<AnimeProviderSettings> {
        return {
            canSmartSearch: true,
            smartSearchFilters: ["batch", "episodeNumber", "resolution", "query", "bestReleases"],
            supportsAdult: false,
            type: "main",
        };
    }

    async search(opts: AnimeSearchOptions): Promise<AnimeTorrent[]> {
        const query = `?query=${encodeURIComponent(opts.query)}`;
        const torrents = await this.fetchTorrents(query);
        return torrents.map((t) => this.toAnimeTorrent(t));
    }

    async smartSearch(opts: AnimeSmartSearchOptions): Promise<AnimeTorrent[]> {
        const filters = [];
        if (opts.batch) filters.push("batch");
        if (opts.episodeNumber > 0) filters.push(`episode-${opts.episodeNumber}`);
        if (opts.resolution) filters.push(`resolution-${opts.resolution}`);
        if (opts.bestReleases) filters.push("best");
        
        const query = `?query=${encodeURIComponent(opts.query)}&filters=${filters.join(",")}`;
        const torrents = await this.fetchTorrents(query);
        return torrents.map((t) => this.toAnimeTorrent(t));
    }

    async getLatest(): Promise<AnimeTorrent[]> {
        const torrents = await this.fetchTorrents("?latest=1");
        return torrents.map((t) => this.toAnimeTorrent(t));
    }

    async fetchTorrents(query: string): Promise<any[]> {
        const url = `${this.api}/torrents${query}`;
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`Failed to fetch torrents: ${response.statusText}`);
            return await response.json();
        } catch (error) {
            console.error(`Error fetching torrents: ${error}`);
            return [];
        }
    }

    toAnimeTorrent(torrent: any): AnimeTorrent {
        return {
            name: torrent.title,
            date: new Date(torrent.timestamp * 1000).toISOString(),
            size: torrent.size,
            formattedSize: "",
            seeders: torrent.seeders,
            leechers: torrent.leechers,
            downloadCount: torrent.downloads,
            link: torrent.pageUrl,
            downloadUrl: torrent.downloadUrl,
            magnetLink: torrent.magnet,
            infoHash: torrent.infoHash,
            resolution: torrent.resolution,
            isBatch: torrent.isBatch,
            episodeNumber: torrent.episode || -1,
            releaseGroup: torrent.group,
            isBestRelease: torrent.isBest,
            confirmed: true,
        };
    }
}

export default Provider;
