export function geoDistance(a, b) {
    const [x1, y1] = a;
    const [x2, y2] = b;
    const dx = (x2 - x1) * 67;
    const dy = (y2 - y1) * 111;
    return Math.sqrt(dx ** 2 + dy ** 2);
}

function closestUnvisited(best, visited) {
    let closest = null;
    for (const station in best) {
        if (visited[station]) {
            continue;
        }
        if (closest === null || best[station] < best[closest]) {
            closest = station;
        }
    }
    return closest;
}

export function trackDistance(distances, a, b) {
    const best = {};
    const visited = {};
    const cameFrom = {};
    best[a] = 0;

    let current = a;
    while (current !== b) {
        visited[current] = true;

        for (const next in distances[current]) {
            const candidate = best[current] + distances[current][next];
            if (best[next] === undefined || candidate < best[next]) {
                best[next] = candidate;
                cameFrom[next] = current;
            }
        }

        current = closestUnvisited(best, visited);
        if (current === null) {
            return null;
        }
    }

    const route = [b];
    while (route[0] !== a) {
        route.unshift(cameFrom[route[0]]);
    }

    return {
        distance: best[b],
        route: route
    };
}
