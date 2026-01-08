function getDistance(p1, p2) {
    const R = 6371;
    const dLat = deg2rad(p2.lat - p1.lat);
    const dLon = deg2rad(p2.lng - p1.lng);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(p1.lat)) * Math.cos(deg2rad(p2.lat)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function deg2rad(deg) {
    return deg * (Math.PI / 180);
}

function shuffle(array) {
    let currentIndex = array.length, randomIndex;
    while (currentIndex != 0) {
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;
        [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
    }
    return array;
}

class Individual {
    constructor(genes, points) {
        this.genes = genes;
        this.fitness = 0;
        this.distance = 0;
        if (points) {
            this.calcFitness(points);
        }
    }

    calcFitness(points) {
        let d = 0;
        for (let i = 0; i < this.genes.length; i++) {
            const from = points[this.genes[i]];
            const to = points[this.genes[(i + 1) % this.genes.length]];
            d += getDistance(from, to);
        }
        this.distance = d;
        this.fitness = 1 / (d + 1e-10);
    }
}

class GeneticAlgorithm {
    constructor(params) {
        this.popSize = params.popSize || 100;
        this.mutationRate = params.mutationRate || 0.02;
        this.crossoverRate = params.crossoverRate || 0.8;
        this.selectionMethod = params.selectionMethod || 'tournament';
        this.points = params.points || [];

        this.population = [];
        this.generation = 0;
        this.bestSolution = null;
    }

    initPopulation() {
        this.population = [];
        this.generation = 0;
        const indices = this.points.map((_, i) => i);

        for (let i = 0; i < this.popSize; i++) {
            let genes = (i === 0) ? [...indices] : shuffle([...indices]);
            this.population.push(new Individual(genes, this.points));
        }
        this.findBest();
    }

    findBest() {
        let best = this.population[0];
        for (let ind of this.population) {
            if (ind.fitness > best.fitness) {
                best = ind;
            }
        }
        if (!this.bestSolution || best.fitness > this.bestSolution.fitness) {
            this.bestSolution = best;
        }
    }

    evolve() {
        let newPop = [];
        newPop.push(this.bestSolution);

        while (newPop.length < this.popSize) {
            let p1 = this.select();
            let p2 = this.select();

            let childGenes;
            if (Math.random() < this.crossoverRate) {
                childGenes = this.crossoverOX(p1.genes, p2.genes);
            } else {
                childGenes = [...p1.genes];
            }

            this.mutate(childGenes);

            newPop.push(new Individual(childGenes, this.points));
        }

        this.population = newPop;
        this.generation++;
        this.findBest();
    }

    select() {
        if (this.selectionMethod === 'roulette') {
            let transformFitness = this.population.map(i => i.fitness);
            let sum = transformFitness.reduce((a, b) => a + b, 0);
            let r = Math.random() * sum;
            let acc = 0;
            for (let i = 0; i < this.population.length; i++) {
                acc += transformFitness[i];
                if (acc >= r) return this.population[i];
            }
            return this.population[this.population.length - 1];
        } else {
            // Tournament
            const k = 5;
            let best = null;
            for (let i = 0; i < k; i++) {
                let ind = this.population[Math.floor(Math.random() * this.population.length)];
                if (!best || ind.fitness > best.fitness) {
                    best = ind;
                }
            }
            return best;
        }
    }

    crossoverOX(parent1, parent2) {
        const start = Math.floor(Math.random() * parent1.length);
        const end = Math.floor(Math.random() * (parent1.length - start)) + start;

        const child = new Array(parent1.length).fill(-1);
        for (let i = start; i <= end; i++) {
            child[i] = parent1[i];
        }

        let p2Index = 0;
        for (let i = 0; i < child.length; i++) {
            let currentPos = (end + 1 + i) % child.length;
            if (child[currentPos] === -1) {
                while (child.includes(parent2[p2Index])) {
                    p2Index++;
                }
                child[currentPos] = parent2[p2Index];
            }
        }
        return child;
    }

    mutate(genes) {
        if (Math.random() < this.mutationRate) {
            if (Math.random() < 0.5) {
                this.mutateSwap(genes);
            } else {
                this.mutateInversion(genes);
            }
        }
    }

    mutateSwap(genes) {
        const i = Math.floor(Math.random() * genes.length);
        const j = Math.floor(Math.random() * genes.length);
        [genes[i], genes[j]] = [genes[j], genes[i]];
    }

    mutateInversion(genes) {
        let i = Math.floor(Math.random() * genes.length);
        let j = Math.floor(Math.random() * genes.length);
        if (i > j) [i, j] = [j, i];

        let temp = genes.slice(i, j + 1).reverse();
        for (let k = 0; k < temp.length; k++) {
            genes[i + k] = temp[k];
        }
    }
}

const App = {
    map: null,
    markers: [],
    polyline: null,
    points: [],
    ga: null,
    running: false,
    timer: null,

    init() {
        this.initMap();
        this.bindEvents();
    },

    initMap() {
        this.map = L.map('map').setView([46.3497, 48.0408], 12);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap contributors'
        }).addTo(this.map);

        this.map.on('click', (e) => {
            if (this.running) return;
            if (this.points.length >= 50) {
                alert("Максимум 50 точек.");
                return;
            }
            this.addPoint(e.latlng);
        });
    },

    addPoint(latlng) {
        const marker = L.marker(latlng, { draggable: false }).addTo(this.map);

        marker.on('contextmenu', () => {
            if (this.running) return;
            this.removePoint(marker);
        });

        this.markers.push(marker);
        this.points.push({ lat: latlng.lat, lng: latlng.lng });
        this.updateStatsUI();
    },

    removePoint(marker) {
        const idx = this.markers.indexOf(marker);
        if (idx > -1) {
            this.map.removeLayer(marker);
            this.markers.splice(idx, 1);
            this.points.splice(idx, 1);
            this.updateStatsUI();
        }
    },

    clearAll() {
        this.markers.forEach(m => this.map.removeLayer(m));
        this.markers = [];
        this.points = [];
        if (this.polyline) {
            this.map.removeLayer(this.polyline);
            this.polyline = null;
        }
        this.resetGA();
        this.updateStatsUI();
    },

    bindEvents() {
        document.getElementById('btn-clear-points').onclick = () => {
            if (!this.running) this.clearAll();
        };

        document.getElementById('btn-start').onclick = () => this.toggleStart();
        document.getElementById('btn-pause').onclick = () => this.togglePause();
        document.getElementById('btn-reset').onclick = () => this.resetGA();
    },

    getParams() {
        return {
            points: this.points,
            popSize: parseInt(document.getElementById('population-size').value, 10),
            mutationRate: parseFloat(document.getElementById('mutation-rate').value),
            crossoverRate: parseFloat(document.getElementById('crossover-rate').value),
            selectionMethod: document.getElementById('selection-method').value
        };
    },

    toggleStart() {
        if (this.points.length < 3) {
            alert("Нужно минимум 3 точки.");
            return;
        }

        if (this.running) return;

        this.setRunningState(true);

        if (!this.ga) {
            this.ga = new GeneticAlgorithm(this.getParams());
            this.ga.initPopulation();
            this.drawRoute(this.ga.bestSolution);
        }

        this.running = true;
        this.loop();
    },

    togglePause() {
        this.running = false;
        cancelAnimationFrame(this.timer);
        this.setRunningState(false);
    },

    resetGA() {
        this.running = false;
        if (this.timer) cancelAnimationFrame(this.timer);
        this.ga = null;
        if (this.polyline) {
            this.map.removeLayer(this.polyline);
            this.polyline = null;
        }
        this.updateStatsUI();
        this.setRunningState(false);
    },

    loop() {
        if (!this.running) return;

        this.ga.evolve();

        // Update UI every animation frame
        this.updateStatsUI();
        this.drawRoute(this.ga.bestSolution);

        this.timer = requestAnimationFrame(() => this.loop());
    },

    drawRoute(individual) {
        if (!individual) return;

        const pathCoords = individual.genes.map(i => this.points[i]);
        pathCoords.push(pathCoords[0]);

        if (this.polyline) {
            this.polyline.setLatLngs(pathCoords);
        } else {
            this.polyline = L.polyline(pathCoords, { color: 'red', weight: 3 }).addTo(this.map);
        }
    },

    updateStatsUI() {
        document.getElementById('point-count').innerText = this.points.length;

        if (this.ga) {
            document.getElementById('stat-generation').innerText = this.ga.generation;
            document.getElementById('stat-distance').innerText = this.ga.bestSolution.distance.toFixed(2) + " км";
        } else {
            document.getElementById('stat-generation').innerText = "0";
            document.getElementById('stat-distance').innerText = "0 км";
        }
    },

    setRunningState(isRunning) {
        document.getElementById('btn-start').disabled = isRunning;
        document.getElementById('btn-pause').disabled = !isRunning;
        document.getElementById('btn-reset').disabled = isRunning;
        document.getElementById('btn-clear-points').disabled = isRunning;

        const inputs = document.querySelectorAll('input, select');
        inputs.forEach(el => el.disabled = isRunning);
    }
};

App.init();
