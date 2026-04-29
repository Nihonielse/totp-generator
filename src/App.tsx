import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import "./App.css";
import { KeyList } from "./KeyList.tsx";

type Account = {
	id: string;
	name: string;
};

function App() {
	const [keyDetails, setKeyDetails] = useState(0);
	const [accounts, setAccounts] = useState<Account[]>([]);
	const [otpCodes, setOtpCodes] = useState<Record<string, string>>({});
	const [keyName, setKeyName] = useState("");
	const [keySecret, setKeySecret] = useState("");
	const [keyID, setKeyID] = useState("");
	const [showSecret, setShowSecret] = useState("");
	const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const keyNameRef = useRef<HTMLInputElement>(null);

	// 起動時に一度だけ取得
	useEffect(() => {
		loadAccounts();
		setInterval(loadAccounts, 30000);
	}, []);

	async function loadAccounts() {
		const result = await invoke<Account[]>("get_accounts");
		setAccounts(result);

		const codes: Record<string, string> = {};
		for (const account of result) {
			try {
				codes[account.id] = await invoke<string>("get_totp_code", {
					id: account.id,
				});
			} catch (e) {
				console.error("get_totp_code failed for", account.id, e);
				codes[account.id] = "------";
			}
		}
		setOtpCodes(codes);
	}

	async function saveKey(keyName: string, secretKey: string) {
		await invoke("add_account", {
			name: keyName,
			secret: secretKey,
		});
		await loadAccounts(); // 保存後にリストを再取得
	}

	async function modifyKey(
		keyName: string,
		secretKey: string,
		keyID: string,
	) {
		await invoke("update_account", {
			name: keyName,
			secret: secretKey === "" ? null : secretKey,
			id: keyID,
		});
		await loadAccounts(); // 保存後にリストを再取得
	}

	async function deleteKey(keyID: string) {
		try {
			await invoke("delete_account", { id: keyID });
		} catch (e) {
			console.error("delete error:", e);
		}
		await loadAccounts();
	}

	async function showSecretTemporarily(keyID: string) {
		setShowSecret(await invoke("get_secret", { id: keyID }));
		timerRef.current = setTimeout(() => setShowSecret(""), 10000); // 10秒後に非表示
	}

	async function exportAccounts() {
		const data =
			await invoke<{ id: string; name: string; secret: string }[]>(
				"export_accounts",
			);
		const json = JSON.stringify(data, null, 2);
		const blob = new Blob([json], { type: "application/json" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = "totp-export.json";
		a.click();
		URL.revokeObjectURL(url);
	}

	async function importAccounts(e: React.ChangeEvent<HTMLInputElement>) {
		const file = e.target.files?.[0];
		if (!file) return;
		const text = await file.text();
		const data = JSON.parse(text);
		await invoke("import_accounts", { data });
		await loadAccounts();
	}

	return (
		<div className="w-full h-full pl-1 bg-blue-950 text-white">
			<header>
				<h1 className="text-4xl">TOTP Generator</h1>
			</header>
			<hr className="m-2" />
			<main>
				<div
					className={`mt-1 ${keyDetails === 0 ? "block" : "hidden"}`}
				>
					<button
						onClick={() => {
							setKeyDetails(1);
							setKeyName("");
							setKeySecret("");
							setKeyID("");
							setTimeout(() => {
								keyNameRef.current?.focus();
							}, 0);
						}}
						className="bg-green-500 hover:bg-green-600 px-4 py-0.5 rounded"
					>
						Add Key
					</button>
					<button
						onClick={exportAccounts}
						className="bg-gray-500 hover:bg-gray-600 px-4 py-0.5 rounded ml-4"
					>
						Export Keys
					</button>
					<label className="bg-gray-500 hover:bg-gray-600 px-4 py-0.5 rounded cursor-pointer ml-2">
						Import Keys
						<input
							type="file"
							accept=".json"
							className="hidden"
							onChange={importAccounts}
						/>
					</label>
				</div>
				<div className={keyDetails === 0 ? "flex flex-wrap" : "hidden"}>
					{accounts.map((account) => (
						<KeyList
							key={account.id}
							id={account.id}
							keyName={account.name}
							otp={otpCodes[account.id] ?? "------"}
							onEdit={() => {
								setKeyDetails(2);
								setTimeout(() => {
									keyNameRef.current?.focus();
								}, 0);
							}}
							setKeyName={setKeyName}
							setKeyID={setKeyID}
						/>
					))}
				</div>
				<div className={keyDetails === 0 ? "hidden" : "block"}>
					<h2 className="text-2xl">
						{keyDetails === 1 ? "Add Key" : "Modify Key"}
					</h2>
					<label className="m-1 table">
						Name:
						<input
							ref={keyNameRef}
							type="text"
							className="bg-gray-200 hover:bg-gray-300 text-black rounded"
							value={keyName}
							onChange={(e) => setKeyName(e.target.value)}
						/>
					</label>
					<label className="m-1 table">
						Secret Key:
						<input
							type="text"
							className="bg-gray-200 hover:bg-gray-300 text-black rounded"
							value={keySecret}
							onChange={(e) => setKeySecret(e.target.value)}
						/>
					</label>
					<input
						type="hidden"
						value={keyID}
						onChange={(e) => setKeyID(e.target.value)}
					></input>
					<div className="table">
						<button
							onClick={async () => {
								await saveKey(keyName, keySecret);
								setKeyName("");
								setKeySecret("");
								setKeyDetails(0);
							}}
							className={`bg-blue-500 hover:bg-blue-600 px-4 py-0.5 rounded m-1 ${keyDetails === 2 ? "hidden" : ""}`}
						>
							Save
						</button>
						<button
							onClick={async () => {
								await modifyKey(keyName, keySecret, keyID);
								setKeyDetails(0);
								setKeyName("");
								setKeySecret("");
								setKeyID("");
							}}
							className={`bg-blue-500 hover:bg-blue-600 px-4 py-0.5 rounded m-1 ${keyDetails === 1 ? "hidden" : ""}`}
						>
							Modify
						</button>
						<button
							onClick={() => {
								setKeyDetails(0);
								setKeyName("");
								setKeySecret("");
								setKeyID("");
							}}
							className="bg-gray-500 hover:bg-gray-600 px-4 py-0.5 rounded m-1"
						>
							Cancel
						</button>
						<button
							onClick={async () => {
								await deleteKey(keyID);
								setKeyDetails(0);
								setKeyName("");
								setKeySecret("");
								setKeyID("");
							}}
							className={`bg-red-500 hover:bg-red-600 px-4 py-0.5 rounded m-1 ${keyDetails === 1 ? "hidden" : ""}`}
						>
							Delete
						</button>
					</div>
					<br />
					<div className={keyDetails === 1 ? "hidden" : "table"}>
						<button
							onClick={() => {
								if (showSecret) {
									setShowSecret("");
									if (timerRef.current) {
										clearTimeout(timerRef.current);
									}
								} else {
									showSecretTemporarily(keyID);
								}
							}}
							className="bg-yellow-500 hover:bg-yellow-600 px-2 py-0.5 rounded ml-2"
						>
							{showSecret ? "Hide" : "Show"} Secret Key (Hide in
							10 seconds)
						</button>
						<div className="ml-2 text-2xl">
							Secret Key:
							<span
								className={`font-bold ${showSecret ? "cursor-pointer" : ""}`}
								onClick={() =>
									navigator.clipboard.writeText(showSecret)
								}
							>
								{showSecret ? showSecret : "••••••••"}
							</span>
						</div>
					</div>
				</div>
			</main>
		</div>
	);
}

export default App;
