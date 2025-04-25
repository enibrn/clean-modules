import { Dirent, promises as fs } from "fs";
import * as path from "path";
import readline from "readline";

const fullPathToIgnore: string[] = [
  'C:\\Users\\binel\\workspace\\experiments\\TS\\clean-modules'
];

const relativePathToIgnore: string[] = [
  'git',
  'dist',
  'build',
  'out',
  'lib',
  'test'
];

const paths: string[] = [];
let globalTotal = 0;

async function getDirectorySize(dirPath: string): Promise<number> {
  let totalSize = 0;
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        totalSize += await getDirectorySize(fullPath);
      } else if (entry.isFile()) {
        try {
          const stat = await fs.stat(fullPath);
          totalSize += stat.size;
        } catch (error) {
          console.error(`Errore nel ottenere la dimensione del file ${fullPath}: ${error}`);
        }
      }
    }
  } catch (err) {
    console.error(`Impossibile leggere la directory ${dirPath}: ${err}`);
  }
  return totalSize;
}

async function scanDirectories(initialPath: string): Promise<void> {
  try {
    const entries: Dirent[] = await fs.readdir(initialPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(initialPath, entry.name);

      if (!entry.isDirectory()) {
        continue;
      }

      if (relativePathToIgnore.some((ignorePath) => entry.name == ignorePath)) {
        //console.log(`Ignorato (RP): ${fullPath}`);
        continue;
      }

      if (fullPathToIgnore.some((ignorePath) => fullPath == ignorePath)) {
        //console.log(`Ignorato (FP): ${fullPath}`);
        continue;
      }

      if (entry.name === "node_modules") {
        const size = await getDirectorySize(fullPath);
        globalTotal += size;
        const sizeMB = bytesToMB(size);
        console.log(`Trovato: ${fullPath} - Dimensione: ${sizeMB} MB`);
        paths.push(fullPath);
        continue;
      }

      await scanDirectories(fullPath);
    }
  } catch (err) {
    console.error(`Errore durante la scansione della directory ${initialPath}: ${err}`);
  }
}

//convert from bytes to MB to string
function bytesToMB(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(2);
}

function askQuestion(query: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise<string>((resolve) =>
    rl.question(query, (ans) => {
      rl.close();
      resolve(ans);
    })
  );
}

async function deletePaths(): Promise<void> {
  // Elimina ricorsivamente ogni directory con fs.rm
  for (const dirPath of paths) {
    try {
      await fs.rm(dirPath, { recursive: true, force: true });
      console.log(`Eliminata: ${dirPath}`);
    } catch (error) {
      console.error(`Errore nell'eliminare ${dirPath}: ${error}`);
    }
  }
}

function printResults() {
  const totalMB = bytesToMB(globalTotal);
  console.log(`Dimensione totale: ${totalMB} MB`);
}

// Il percorso iniziale viene passato come argomento oppure viene usata la directory corrente
const startPath = process.argv[2] || ".";
scanDirectories(startPath).then(async () => {
  printResults();
  const answer = await askQuestion("Confermi di eliminare le cartelle node_modules trovate? (Y/n): ");
  if (answer.trim().toLowerCase() === "y") {
    await deletePaths();
  }
});