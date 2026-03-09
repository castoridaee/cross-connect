import fs from 'fs';
const content = fs.readFileSync('src/pages/AuthorProfile.jsx', 'utf8');

const s1 = '<div key={p.id} className="bg-white p-6 rounded-2xl';
const s2 = '))}';
const i1 = content.indexOf(s1);
const i2 = content.indexOf(s2, i1);

if (i1 !== -1 && i2 !== -1) {
    const newContent = content.substring(0, i1) + `<PuzzleCard
            key={p.id}
            puzzle={p}
            solveStatus={solveStatus}
            tab={activeTab}
            onNavigateToPuzzle={onNavigateToPuzzle}
            onActionClick={isOwner ? setDeletingPuzzle : null}
          />
        ` + content.substring(i2);
    fs.writeFileSync('src/pages/AuthorProfile.jsx', newContent);
    console.log("Success");
} else {
    console.log("Failed");
}
