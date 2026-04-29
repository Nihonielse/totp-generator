use keyring::Entry;
use serde::{Deserialize, Serialize};
use std::fs;
use tauri::{command, AppHandle, Manager};

const SERVICE_NAME: &str = "mkants-totp-generator";

#[derive(Serialize, Deserialize, Clone)]
struct Account {
    id: String,
    name: String,
}

fn accounts_path(app: &AppHandle) -> std::path::PathBuf {
    app.path().app_data_dir().unwrap().join("accounts.json")
}

fn load_accounts(app: &AppHandle) -> Vec<Account> {
    let path = accounts_path(app);
    if !path.exists() {
        return vec![];
    }
    let data = fs::read_to_string(path).unwrap_or_default();
    serde_json::from_str(&data).unwrap_or_default()
}

fn save_accounts(app: &AppHandle, accounts: &Vec<Account>) -> Result<(), String> {
    let path = accounts_path(app);
    fs::create_dir_all(path.parent().unwrap()).map_err(|e| e.to_string())?;
    let data = serde_json::to_string(accounts).map_err(|e| e.to_string())?;
    fs::write(path, data).map_err(|e| e.to_string())?;
    Ok(())
}

// アカウント一覧取得
#[command]
fn get_accounts(app: AppHandle) -> Vec<Account> {
    load_accounts(&app)
}

#[command]
fn add_account(app: AppHandle, name: String, secret: String) -> Result<Account, String> {
    let id = format!(
        "{}_{}",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_millis(),
        rand::random::<u32>()
    );

    let entry = Entry::new(SERVICE_NAME, &id).map_err(|e| e.to_string())?;
    match entry.set_password(&secret) {
        Ok(_) => println!("saved to keyring: '{}'", id),
        Err(e) => println!("keyring save failed: {:?}", e), // ここが出ているはず
    }
    entry.set_password(&secret).map_err(|e| e.to_string())?;

    let account = Account { id, name };
    let mut accounts = load_accounts(&app);
    accounts.push(account.clone());
    save_accounts(&app, &accounts)?;

    Ok(account)
}

#[command]
fn get_totp_code(id: String) -> Result<String, String> {
    let entry = Entry::new(SERVICE_NAME, &id).map_err(|e| e.to_string())?;
    let secret = entry
        .get_password()
        .map_err(|e| format!("get_password error: {:?}", e))?;

    let totp = totp_rs::TOTP::new_unchecked(
        totp_rs::Algorithm::SHA1,
        6,
        1,
        30,
        totp_rs::Secret::Encoded(secret)
            .to_bytes()
            .map_err(|e| e.to_string())?,
        None,
        id.clone(),
    );

    totp.generate_current().map_err(|e| e.to_string())
}

#[command]
fn delete_account(app: AppHandle, id: String) -> Result<(), String> {
    let entry = Entry::new(SERVICE_NAME, &id).map_err(|e| e.to_string())?;
    entry.delete_credential().map_err(|e| e.to_string())?;

    let mut accounts = load_accounts(&app);
    accounts.retain(|a| a.id != id);
    save_accounts(&app, &accounts)?;

    Ok(())
}

#[command]
fn get_secret(id: String) -> Result<String, String> {
    let entry = Entry::new(SERVICE_NAME, &id).map_err(|e| e.to_string())?;
    entry
        .get_password()
        .map_err(|e| format!("get_password error: {:?}", e))
}

#[command]
fn update_account(
    app: AppHandle,
    id: String,
    name: String,
    secret: Option<String>,
) -> Result<(), String> {
    let mut accounts = load_accounts(&app);
    if let Some(account) = accounts.iter_mut().find(|a| a.id == id) {
        account.name = name;
    }
    save_accounts(&app, &accounts)?;

    if let Some(secret) = secret {
        let entry = Entry::new(SERVICE_NAME, &id).map_err(|e| e.to_string())?;
        entry.set_password(&secret).map_err(|e| e.to_string())?;
    }

    Ok(())
}

#[derive(Serialize)]
struct AccountWithSecret {
    id: String,
    name: String,
    secret: String,
}

#[command]
fn export_accounts(app: AppHandle) -> Result<Vec<AccountWithSecret>, String> {
    let accounts = load_accounts(&app);
    let mut result = vec![];
    for account in accounts {
        let entry = Entry::new(SERVICE_NAME, &account.id).map_err(|e| e.to_string())?;
        let secret = entry.get_password().map_err(|e| e.to_string())?;
        result.push(AccountWithSecret {
            id: account.id,
            name: account.name,
            secret,
        });
    }
    Ok(result)
}
#[derive(Deserialize)]
struct ImportAccount {
    name: String,
    secret: String,
}

#[command]
fn import_accounts(app: AppHandle, data: Vec<ImportAccount>) -> Result<(), String> {
    for account in data {
        let id = format!(
            "{}_{}",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_millis(),
            rand::random::<u32>()
        );
        let entry = Entry::new(SERVICE_NAME, &id).map_err(|e| e.to_string())?;
        entry.set_password(&account.secret).map_err(|e| e.to_string())?;

        let mut accounts = load_accounts(&app);
        accounts.push(Account { id, name: account.name });
        save_accounts(&app, &accounts)?;
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            add_account,
            get_accounts,
            get_totp_code,
            delete_account,
            get_secret,
            update_account,
            export_accounts,
            import_accounts
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
