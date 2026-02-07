use serde::{Deserialize, Serialize};

use crate::domain::entities::{claims::Claims, client::Client, user::User};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum Identity {
    User(User),
    Client(Client),
    Anonymous,
}

impl Identity {
    pub fn id(&self) -> Option<&str> {
        match self {
            Identity::User(user) => Some(&user.id),
            Identity::Client(client) => Some(&client.id),
            Identity::Anonymous => None,
        }
    }

    pub fn is_user(&self) -> bool {
        matches!(self, Identity::User(_))
    }

    pub fn is_client(&self) -> bool {
        matches!(self, Identity::Client(_))
    }

    pub fn is_anonymous(&self) -> bool {
        matches!(self, Identity::Anonymous)
    }

    pub fn username(&self) -> Option<&str> {
        match self {
            Identity::User(user) => Some(&user.username),
            Identity::Client(client) => Some(&client.client_id),
            Identity::Anonymous => None,
        }
    }

    pub fn roles(&self) -> Vec<String> {
        match self {
            Identity::User(user) => user.roles.clone(),
            Identity::Client(client) => client.roles.clone(),
            Identity::Anonymous => vec![],
        }
    }

    pub fn has_role(&self, role: &str) -> bool {
        self.roles().iter().any(|r| r == role)
    }
}

impl From<Claims> for Identity {
    fn from(claims: Claims) -> Self {
        if let Some(client_id) = claims.client_id.clone() {
            Identity::Client(Client {
                id: claims.sub.0.clone(),
                client_id,
                roles: vec![],
                scopes: claims
                    .scope
                    .split_whitespace()
                    .map(|s| s.to_string())
                    .collect(),
            })
        } else {
            Identity::User(User {
                id: claims.sub.0.clone(),
                username: claims.preferred_username.clone(),
                email: claims.email.clone(),
                name: claims.name.clone(),
                roles: vec![],
            })
        }
    }
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use crate::domain::entities::{
        claims::{Claims, Subject},
        identity::Identity,
    };

    fn create_user_claims() -> Claims {
        Claims {
            sub: Subject("user-123".to_string()),
            iss: "https://auth.ferriscord.com".to_string(),
            aud: Some("ferriscord-api".to_string()),
            email: Some("john.doe@example.com".to_string()),
            email_verified: true,
            exp: None,
            name: Some("John Doe".to_string()),
            preferred_username: "johndoe".to_string(),
            given_name: Some("John".to_string()),
            family_name: Some("Doe".to_string()),
            scope: "openid profile email".to_string(),
            client_id: None,
            extra: {
                let mut map = serde_json::Map::new();
                map.insert(
                    "realm_access".to_string(),
                    json!({
                        "roles": ["user", "moderator"]
                    }),
                );
                map
            },
        }
    }

    fn create_service_account_claims() -> Claims {
        Claims {
            sub: Subject("service-123".to_string()),
            iss: "https://auth.ferriscord.com".to_string(),
            aud: Some("ferriscord-api".to_string()),
            email: None,
            email_verified: false,
            name: None,
            exp: None,
            preferred_username: "service-account-bot".to_string(),
            given_name: None,
            family_name: None,
            scope: "admin:all read:users write:messages".to_string(),
            client_id: Some("ferriscord-bot".to_string()),
            extra: {
                let mut map = serde_json::Map::new();
                map.insert(
                    "realm_access".to_string(),
                    json!({
                        "roles": ["service", "bot"]
                    }),
                );
                map
            },
        }
    }

    #[test]
    fn test_claims_to_identity_user() {
        let claims = create_user_claims();
        let identity: Identity = claims.into();

        match identity {
            Identity::User(user) => {
                assert_eq!(user.id, "user-123");
                assert_eq!(user.username, "johndoe");
                assert_eq!(user.email, Some("john.doe@example.com".to_string()));
                assert_eq!(user.name, Some("John Doe".to_string()));
            }
            Identity::Client(_) => panic!("Expected User, got Client"),
            Identity::Anonymous => panic!("Expected User, got Anonymous"),
        }
    }

    #[test]
    fn test_claims_to_identity_service_account() {
        let claims = create_service_account_claims();
        let identity: Identity = claims.into();

        match identity {
            Identity::Client(client) => {
                assert_eq!(client.id, "service-123");
                assert_eq!(client.client_id, "ferriscord-bot");
            }
            Identity::User(_) => panic!("Expected Client, got User"),
            Identity::Anonymous => panic!("Expected Client, got Anonymous"),
        }
    }

    #[test]
    fn test_identity_accessors_for_user() {
        let claims = create_user_claims();
        let identity: Identity = claims.into();

        assert!(identity.is_user());
        assert!(!identity.is_client());
        assert_eq!(identity.id(), Some("user-123"));
        assert_eq!(identity.username(), Some("johndoe"));
        assert!(identity.roles().is_empty());
        assert!(!identity.has_role("admin"));
    }

    #[test]
    fn test_identity_accessors_for_client() {
        let claims = create_service_account_claims();
        let identity: Identity = claims.into();

        assert!(identity.is_client());
        assert!(!identity.is_user());
        assert_eq!(identity.id(), Some("service-123"));
        assert_eq!(identity.username(), Some("ferriscord-bot"));
        assert!(identity.roles().is_empty());
        assert!(!identity.has_role("service"));
    }
}
