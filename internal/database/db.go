package database

import (
	"database/sql"
	
	_ "modernc.org/sqlite"
)

type DB struct {
	conn *sql.DB
}

func New(databasePath string) (*DB, error) {
	conn, err := sql.Open("sqlite", databasePath)
	if err != nil {
		return nil, err
	}

	return &DB{
		conn: conn,
	}, nil
}

func (db *DB) Close() error {
	return db.conn.Close()
}