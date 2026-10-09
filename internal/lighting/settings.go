package lighting

type Settings struct {
	Mode       string            `json:"mode"`
	Color      string            `json:"color"`
	Secondary  string            `json:"secondary"`
	Brightness int               `json:"brightness"`
	Speed      int               `json:"speed"`
	Power      bool              `json:"power"`
	Overrides  map[string]string `json:"overrides"`
}
