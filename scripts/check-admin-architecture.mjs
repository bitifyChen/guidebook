import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const adminPagesDir = path.join(root, 'src', 'pages', 'admin');
const adminComponentsDir = path.join(root, 'src', 'components', 'admin');
const sharedDir = path.join(adminComponentsDir, 'shared');
const domains = {
  trip: 'AdminTrip',
  itinerary: 'AdminItinerary',
  participant: 'AdminParticipant',
  notification: 'AdminNotification',
  packing: 'AdminPacking',
  config: 'AdminConfig',
};

const walk = (directory, extension = '') =>
  fs.existsSync(directory)
    ? fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const filename = path.join(directory, entry.name);
        if (entry.isDirectory()) return walk(filename, extension);
        return !extension || filename.endsWith(extension) ? [filename] : [];
      })
    : [];

const relative = (filename) =>
  path.relative(root, filename).replaceAll('\\', '/');
const errors = [];
const disallowedManagerFiles = new Set(
  Object.entries(domains).map(
    ([domain, prefix]) => `src/components/admin/${domain}/${prefix}Manager.vue`
  )
);

for (const filename of walk(adminPagesDir, '.vue')) {
  const source = fs.readFileSync(filename, 'utf8');
  if (/from\s+['"][^'"]*pages\/admin\//.test(source)) {
    errors.push(`${relative(filename)} 不得 import 其他 Admin Page`);
  }
  if (
    /<template>\s*<Admin(?:Trip|Itinerary|Participant|Notification|Packing|Config)Manager\s*\/?\s*>\s*<\/template>/s.test(
      source
    )
  ) {
    errors.push(`${relative(filename)} 不得只包裹整頁 Manager 元件`);
  }
}

for (const filename of walk(sharedDir, '.vue')) {
  const source = fs.readFileSync(filename, 'utf8');
  if (/['"]@\/api\//.test(source)) {
    errors.push(`${relative(filename)} shared 元件不得依賴領域 API`);
  }
  if (
    new RegExp(
      `['"]@/components/admin/(${Object.keys(domains).join('|')})/`
    ).test(source)
  ) {
    errors.push(`${relative(filename)} shared 元件不得依賴 domain 元件`);
  }
}

for (const filename of fs.readdirSync(adminComponentsDir, {
  withFileTypes: true,
})) {
  if (filename.isFile() && filename.name.endsWith('.vue')) {
    errors.push(`src/components/admin/${filename.name} 不得放在 admin 根目錄`);
  }
}

for (const [domain, prefix] of Object.entries(domains)) {
  const directory = path.join(adminComponentsDir, domain);
  for (const filename of walk(directory, '.vue')) {
    if (!path.basename(filename).startsWith(prefix)) {
      errors.push(`${relative(filename)} 檔名必須以 ${prefix} 開頭`);
    }
  }
}

for (const filename of disallowedManagerFiles) {
  if (fs.existsSync(path.join(root, filename))) {
    errors.push(`${filename} 是無意義的整頁包裹層，內容應回到 page`);
  }
}

if (errors.length) {
  console.error('Admin architecture check failed:\n');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log('Admin architecture check passed.');
